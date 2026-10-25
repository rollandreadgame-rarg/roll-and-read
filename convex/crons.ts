// @ts-nocheck
// Scheduled clean-up that carries out the published data retention policy.
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily("delete inactive readers", { hourUTC: 9, minuteUTC: 0 }, internal.dataLifecycle.purgeInactiveReaders);
crons.daily("delete old crash reports", { hourUTC: 9, minuteUTC: 15 }, internal.dataLifecycle.purgeOldErrorReports);

export default crons;
