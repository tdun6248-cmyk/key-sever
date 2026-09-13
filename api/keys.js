const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

function genKey(len = 20) {
  return crypto.randomBytes(len)
    .toString('base64url').slice(0, len).toUpperCase();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { action, key, device_id, duration, count = 1 } = req.body || {};

  if (action === 'create') {
    const hrs = { '1h':1,'1d':24,'7d':168,'14d':336,'30d':720 };
    const h = hrs[duration] || 24;
    const expires = new Date(Date.now() + h * 3600000);
    const keys = [];
    for (let i = 0; i < Math.min(count, 500); i++) {
      const { data } = await supabase.from('keys')
        .insert({ key_value: genKey(), expires_at: expires })
        .select().single();
      keys.push(data);
    }
    return res.json({ success: true, keys });
  }

  if (action === 'verify') {
    const { data } = await supabase.from('keys')
      .select('*').eq('key_value', key).single();
    if (!data || !data.is_active) return res.json({ valid: false, reason: 'invalid' });
    if (new Date(data.expires_at) < new Date()) return res.json({ valid: false, reason: 'expired' });
    if (data.device_id && data.device_id !== device_id) return res.json({ valid: false, reason: 'wrong_device' });
    if (!data.device_id) {
      await supabase.from('keys').update({ device_id }).eq('key_value', key);
    }
    return res.json({ valid: true, expires_at: data.expires_at });
  }

  if (action === 'revoke') {
    await supabase.from('keys').update({ is_active: false }).eq('key_value', key);
    return res.json({ success: true });
  }

  if (action === 'list') {
    const { data } = await supabase.from('keys').select('*').order('created_at', { ascending: false });
    return res.json({ keys: data });
  }

  res.json({ error: 'unknown action' });
};
