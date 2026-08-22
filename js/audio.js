let audioContext=null;

function ctx(){
  if (!audioContext) {
    const C=window.AudioContext||window.webkitAudioContext;
    if (C) audioContext=new C();
  }
  if (audioContext?.state==='suspended') audioContext.resume().catch(()=>{});
  return audioContext;
}

export function tone(enabled=true, freq=760, duration=.09, gain=.055) {
  if (!enabled) return;
  try{
    const c=ctx(); if(!c)return;
    const o=c.createOscillator(), g=c.createGain();
    o.frequency.value=freq; g.gain.value=gain; o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+duration);
  }catch{}
}

export function completeTone(enabled=true) {
  if (!enabled) return;
  tone(true,820,.10); setTimeout(()=>tone(true,1040,.12),120);
}

export function speak(enabled=true,text='') {
  if (!enabled || !text || !('speechSynthesis' in window)) return;
  try{
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(String(text));
    u.rate=1.03; u.pitch=.9; u.volume=.82;
    window.speechSynthesis.speak(u);
  }catch{}
}

export function cue(settings,text,{freq=760,duration=.09,speech=true}={}) {
  tone(settings?.tones!==false,freq,duration);
  if (speech) speak(settings?.voiceCues!==false,text);
}
