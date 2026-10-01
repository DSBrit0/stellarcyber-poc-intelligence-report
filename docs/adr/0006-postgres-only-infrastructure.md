# PostgreSQL is the only stateful service

The target is about 10 concurrent Users on one server, so PostgreSQL holds everything: Users, sessions, PoCs, Report Data (JSONB), settings, the audit log, and the job queue (pg-boss). There is no Redis and no message broker. The result is one thing to back up, one thing to monitor, and transactions that cover both the data and its jobs. If the load ever outgrows this, the queue is the first piece to move out.
