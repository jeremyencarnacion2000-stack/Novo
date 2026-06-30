import { createBlendy } from 'blendy';

// App-wide singleton — import this everywhere instead of creating new instances
export const blendy = createBlendy({ animation: 'dynamic' });