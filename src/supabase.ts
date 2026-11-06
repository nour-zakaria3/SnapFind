import { createClient } from '@supabase/supabase-js';
import { config } from './config';
import { createLocalClient } from './demo/localClient';

/** Demo mode: no Supabase keys configured, or the page was opened with ?demo=1. Everything stays in the browser. */
export const isDemo: boolean =
  config.supabaseUrl.includes('YOUR-PROJECT') ||
  (typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo'));

// Loosely typed on purpose: the demo client implements only the subset of the API this app uses.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = isDemo
  ? createLocalClient()
  : createClient(config.supabaseUrl, config.supabaseAnonKey);
