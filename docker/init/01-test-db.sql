-- Runs once, when the volume is first created. Integration tests use gtas_test so they
-- can wipe and rebuild it without touching the gtas_dev data you click around in.
CREATE DATABASE gtas_test;
