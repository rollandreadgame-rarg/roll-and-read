export default {
  providers: [
    // DEV Clerk instance (local development against the dev Convex deployment)
    {
      domain: "https://smashing-serval-26.clerk.accounts.dev",
      applicationID: "convex",
    },
    // PRODUCTION Clerk instance (rollandreadgame.com → prod Convex giddy-lapwing-388)
    {
      domain: "https://clerk.rollandreadgame.com",
      applicationID: "convex",
    },
  ],
};
