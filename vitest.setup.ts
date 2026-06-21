// Vitest worker setup (runs per test file, before its imports). Loads service
// creds, then leases an ISOLATED test-database branch for THIS file and releases
// it when the file finishes — so DB tests never touch prod and parallel files
// never share a database. See vitest.env.ts.
import { afterAll } from "vitest";
import { loadBaseEnv, leaseTestBranch } from "./vitest.env";

loadBaseEnv();
const releaseBranch = leaseTestBranch();
afterAll(() => releaseBranch());
