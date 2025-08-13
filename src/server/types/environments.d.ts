declare global {
    namespace NodeJS {
      interface ProcessEnv {
        SUPABASE_URL: string;
        SUPABASE_ANON_KEY: string;
        JWT_SECRET: string;
        PORT?: string;
        NODE_ENV?: 'development' | 'production' | 'test';
      }
    }
  }
  