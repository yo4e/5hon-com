import { onRequestPost as __api_generate_ts_onRequestPost } from "/Users/a104/GitHub/5hon-com/functions/api/generate.ts"

export const routes = [
    {
      routePath: "/api/generate",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_generate_ts_onRequestPost],
    },
  ]