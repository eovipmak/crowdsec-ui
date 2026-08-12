// Command crowdsec-dashboard is the entry point for the CrowdSec dashboard
// (architecture §3: "Entry point: load config, wire components, start
// server"). It contains no business logic and no command vectors; it wires the
// config, adapter, auth hook, confirmation service, and API router.
//
// Usage:
//
//	crowdsec-dashboard --config /etc/crowdsec-dashboard/config.yaml
//
// An invalid configuration is a clear startup error and the process exits
// without listening.
package main

import (
	"context"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"crowdsec-dashboard/backend/internal/adapter"
	"crowdsec-dashboard/backend/internal/api"
	"crowdsec-dashboard/backend/internal/config"
	"crowdsec-dashboard/backend/internal/logging"
)

func main() {
	if err := run(); err != nil {
		// Startup/config errors are printed to stderr and exit non-zero.
		fmt.Fprintf(os.Stderr, "crowdsec-dashboard: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	var configPath string
	flag.StringVar(&configPath, "config", "/etc/crowdsec-dashboard/config.yaml", "path to the dashboard configuration file")
	flag.Parse()

	// Load and validate the configuration. Invalid config is a clear startup
	// error; the server exits without listening (architecture §8.3).
	cfg, err := config.Load(configPath)
	if err != nil {
		return err
	}

	logger := logging.New(os.Stderr, logging.ParseLevel(cfg.Logging.Level), cfg.Logging.Format, map[string]any{
		"service": config.ServiceName,
		"version": config.AppVersion,
	})
	logger.Info("starting crowdsec-dashboard", "config", cfg.Redacted())

	// Build the strict cscli adapter. It owns all command vectors and probes
	// capabilities at startup.
	ex, err := adapter.New(adapter.Options{
		ExecutablePath: cfg.ExecutableAbs(),
		Timeout:        cfg.Cscli.Timeout,
		ProfilesPath:   cfg.ProfilesPath(),
	})
	if err != nil {
		logger.Error("failed to initialize CrowdSec adapter", "error", err.Error())
		return fmt.Errorf("failed to initialize CrowdSec adapter: %w", err)
	}

	// Auth hook (task 06 replaces this stub with the real authenticator).
	auth := api.NewStubAuthenticator(cfg.Session.TTL)
	// Mutation confirmation service (in-memory, no application database).
	confirm := api.NewConfirmationService()

	router := api.NewRouterOpts(api.Options{
		Config:   cfg,
		Executor: ex,
		Auth:     auth,
		Confirm:  confirm,
		Logger:   logger,
		// Assets: task 11 wires the embedded frontend bundle here.
	})

	addr := net.JoinHostPort(cfg.Server.Bind, fmt.Sprintf("%d", cfg.Server.Port))
	srv := &http.Server{
		Addr:              addr,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info("listening", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	// Graceful shutdown on SIGINT/SIGTERM.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-errCh:
		return fmt.Errorf("server error: %w", err)
	case <-stop:
		logger.Info("shutting down")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return srv.Shutdown(ctx)
	}
}
