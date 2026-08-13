## 1. Overview

The statistics command (`metrics.show`) is returning the error: "This CrowdSec installation does not support the requested operation."

The following related commands are working: `cscli metrics show`, `cscli metrics show bouncers`, and `cscli metrics show -o json` (where `-o json` outputs the data in JSON format).

## 2. Alerts

The alert overview does not yet clearly display the scope, value, and decisions. Should be adjusted according to this form (related command cscli alerts list -m):

```
root@ubuntu:~/crowdsec-ui# cscli alerts list -m
╭──────┬─────────────────── ─┬────────────────────────── ───────────────────┬─────── ──┬───────────────────────── ─────────────────────────── ──────────┬───────────┬───── ─────────────────┬────────── ┬──────────────────────────╮
│ ID │ value │ reason │ country │ as │ decisions │ created_at │ kind │ machine │
├──────┼─────────────────── ─┼────────────────────────── ───────────────────┼─────── ──┼───────────────────────── ─────────────────────────── ──────────┼───────────┼───── ─────────────────┼────────── ┼──────────────────────────┤
│ 3883 │ Ip:156.204.51.18 │ crowdsecurity/windows-bf │ EG │ 8452 TE Data │ ban:1 │ 2026-08-13T11:45:53Z │ crowdsec │ WIN-C1N43HR2MTF │
│ 3882 │ Ip:156.204.51.18 │ crowdsecurity/windows-bf │ EG │ 8452 TE Data │ ban:1 │ 2026-08-13T11:50:03Z │ crowdsec │ WIN-C1N43HR2MTF │
│ 3881 │ Ip:156.204.51.18 │ crowdsecurity/windows-bf │ EG │ 8452 TE Data │ ban:1 │ 2026-08-13T11:49:12Z │ crowdsec │ WIN-C1N43HR2MTF │
│ 3880 │ Ip:156.204.51.18 │ crowdsecurity/windows-bf │ EG │ 8452 TE Data │ ban:1 │ 2026-08-13T11:41:17Z │ crowdsec │ WIN-C1N43HR2MTF │
│ 3879 │ Ip:156.204.51.18   │ crowdsecurity/windows-bf                    │ EG      │ 8452 TE Data                                                 │ ban:1     │ 2026-08-13T11:48:02Z │ crowdsec │ WIN-C1N4       │          │
```
When clicking to view an alert, execute the command: cscli alerts inspect ID => display a modal showing the information, along with an 'X' button to close it.

Other commands for searching:

cscli alerts list --origin lists
cscli alerts list -s crowdsecurity/ssh-bf

For a specific IP address, use: cscli alerts list -a | grep 109.197.49.27
```
root@ubuntu:~/crowdsec-ui# cscli alerts list -a | grep 109.197.49.27
| 3871 | Ip:109.197.49.27                              | crowdsecurity/ssh-time-based-bf             | RU      | 47211 OOO Kolpinskie Internet-Seti                           | | 2026-08-13T09:56:36Z | crowdsec |
| 3864 | Ip:109.197.49.27                              | crowdsecurity/ssh-time-based-bf             | RU      | 47211 OOO Kolpinskie Internet-Seti                           | | 2026-08-13T08:04:09Z | crowdsec |
| 3845 | Ip:109.197.49.27                              | crowdsecurity/ssh-time-based-bf             | RU      | 47211 OOO Kolpinskie Internet-Seti                           | | 2026-08-13T06:16:16Z | crowdsec |
| 3831 | Ip:109.197.49.27                              | crowdsecurity/ssh-time-based-bf             | RU      | 47211 OOO Kolpinskie Internet-Seti                           | | 2026-08-13T04:35:54Z | crowdsec |
| 3811 | Ip:109.197.49.27                              | crowdsecurity/ssh-time-based-bf             | RU      | 47211 OOO Kolpinskie Internet-Seti                           | | 2026-08-13T02:5
```
Remove Kind and Scope from search criteria.

When changing the limit, run the following command: cscli alerts list -l 10

## 3. Decisions

Verify search and listing capabilities; ensure the output matches the format of the following command:

cscli decisions list

```
╭─────────┬──────────┬────────────────────┬────────────────────────────────────────────┬────────┬─────────┬───────────────────────────────────────┬────────┬────────────┬──────────╮
│    ID   │  Source  │     Scope:Value    │                   Reason                   │ Action │ Country │                   AS                  │ Events │ expiration │ Alert ID │
├─────────┼──────────┼────────────────────┼────────────────────────────────────────────┼────────┼─────────┼───────────────────────────────────────┼────────┼────────────┼──────────┤
│ 1840573 │ crowdsec │ Ip:62.238.5.68     │ crowdsecurity/ssh-slow-bf                  │ ban    │ DE      │                                       │ 27     │ 3h56m55s   │ 3885     │
│ 1840572 │ crowdsec │ Ip:156.204.51.18   │ crowdsecurity/windows-bf                   │ ban    │ EG      │ 8452 TE Data                          │ 7      │ 3h36m24s   │ 3883     │
│ 1840560 │ crowdsec │ Ip:18.143.116.105  │ crowdsecurity/http-open-proxy              │ ban    │ SG      │ 16509 AMAZON-02                       │ 1      │ 2h54m43s   │3870     │
```

Specifically for the IP search, use:

cscli decisions list -a | grep  41.222.202.170
```
| 1050520 | CAPI     | Ip:41.222.202.170                         | ssh:bruteforce                             | ban    | | | 0      | -22h5m2s   | 1203     |
```

Remove "Origin" and "Scope" from the search filters; change "IP or Range" to just "IP".

## 4. Scenarios / Profiles / Collections

=> Remove this section from the UI entirely.