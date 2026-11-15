"""Original Harbor Pulse loop. No third-party samples or music are used."""
import array, math, random, wave
from pathlib import Path
rate=22050
beat=60/96
length=32*beat
out=array.array('f',[0]) * int(rate*length)
def tone(start,duration,note,volume,kind='pad'):
    hz=440*2**((note-69)/12)
    for j in range(min(int(duration*rate),len(out)-int(start*rate))):
        t=j/rate
        if kind=='pad':
            env=min(1,t/.22)*min(1,max(0,(duration-t)/.35))
            value=(math.sin(2*math.pi*hz*t)+.18*math.sin(2*math.pi*hz*2*t))*.55
        else:
            env=min(1,t/.008)*math.exp(-t*(5 if kind=='bass' else 10))
            value=math.sin(2*math.pi*hz*t)+.16*math.sin(2*math.pi*hz*3*t)
        out[int(start*rate)+j]+=value*env*volume
chords=[(50,53,57),(46,50,53),(48,53,57),(48,52,55)]*2
melody=[74,77,81,77,70,74,77,74,72,77,81,77,72,76,79,76]*2
for bar,chord in enumerate(chords):
    for note in chord: tone(bar*4*beat,4*beat,note,.085)
    for step in range(4): tone((bar*4+step)*beat,.52,chord[0]-12,.11,'bass')
    for step in range(4): tone((bar*4+step+.5)*beat,.35,melody[bar*4+step],.065,'pluck')
rng=random.Random(1296)
for step in range(32):
    start=int(step*beat*rate)
    for j in range(min(int(.13*rate),len(out)-start)):
        t=j/rate
        kick=math.sin(2*math.pi*(64*t-130*t*t))*math.exp(-t*32)*(.10 if step%4==0 else .055)
        tick=(rng.random()*2-1)*math.exp(-t*110)*.025
        out[start+j]+=kick+tick
peak=max(abs(v) for v in out)
pcm=array.array('h')
for i,value in enumerate(out):
    edge=min(1,i/(rate*.03),(len(out)-1-i)/(rate*.03))
    pcm.append(int(max(-1,min(1,value/peak*.67*edge))*32767))
path=Path('/tmp/harbor-pulse.wav')
with wave.open(str(path),'wb') as f:
    f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(pcm.tobytes())
print(path)
