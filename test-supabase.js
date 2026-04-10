const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('./src/environments/environment.ts', 'utf8');
const urlMatch = env.match(/supabaseUrl:\s*'([^']+)'/);
const keyMatch = env.match(/supabaseKey:\s*'([^']+)'/);
const supabase = createClient(urlMatch[1], keyMatch[1]);
supabase.from('auction_players').select('*, player:players(*)').limit(1).then(res => console.log(JSON.stringify(res.data, null, 2)));
