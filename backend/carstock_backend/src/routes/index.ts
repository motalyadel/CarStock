
import { Elysia } from 'elysia';

export const apiRoutes = new Elysia({
  prefix: '/api/v1',
})
  .get('/health', () => {
    return {
      success: true,
      message: 'CarStock API is running',
      service: 'carstock-backend',
      timestamp: new Date().toISOString(),
    };
  });
