/// <reference types="vite/client" />
// Every Convex function module, for convex-test. Files with an extra dot
// (*.test.ts, this file) are skipped by Convex deploys and by this glob.
export const modules = import.meta.glob("./**/!(*.*.*)*.*s");
