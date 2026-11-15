"""Loopback-only weather proxy. Run with Python 3.11+."""
import base64, datetime, getpass, json, math, os, re, urllib.error, urllib.request, webbrowser, zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
ROOT = Path(__file__).resolve().parent
PARAMS = ['t_2m:C','wind_dir_10m:d','wind_speed_10m:ms']

def login():
    user, password = os.getenv('METEOMATICS_USER'), os.getenv('METEOMATICS_PASSWORD')
    return (user or input('Meteomatics username: '), password or getpass.getpass('Meteomatics password: '))

def weather(points, credentials, at=None):
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:00:00Z')
    if at:
        stamp=datetime.datetime.strptime(at,'%Y-%m-%dT%H:%M:%SZ').strftime('%Y-%m-%dT%H:%M:%SZ')
    coords = '+'.join(f'{lat:.3f},{lon:.3f}' for lat,lon in points)
    parameters = ",".join(PARAMS + ["precip_1h:mm"])
    url = f'https://api.meteomatics.com/{stamp}/{parameters}/{coords}/json' 
    auth = base64.b64encode(':'.join(credentials).encode()).decode()
    with urllib.request.urlopen(urllib.request.Request(url,headers={'Authorization':'Basic '+auth}),timeout=20) as response:
        data=json.load(response)
    rows={}
    for field in data['data']:
        for p in field['coordinates']:
            key=(round(p['lat'],3),round(p['lon'],3))
            value=p['dates'][0]['value']
            if isinstance(value,(int,float)) and math.isfinite(value) and value!=-999:
                rows.setdefault(key,{})[field['parameter']]=value
    return {'time':stamp,'points':[dict(lat=k[0],lon=k[1],temp=v.get(PARAMS[0]),direction=v.get(PARAMS[1]),speed=v.get(PARAMS[2]),precip=v.get('precip_1h:mm')) for k,v in rows.items()]}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        route=urlsplit(self.path)
        if route.path=='/weather':
            try:
                points=json.loads(parse_qs(route.query)['points'][0])
                if not 1<=len(points)<=48 or not all(-90<=a<=90 and -180<=b<=180 for a,b in points): raise ValueError()
                body=json.dumps(weather(points,self.server.credentials,parse_qs(route.query).get("at",[None])[0])).encode()
            except urllib.error.HTTPError as e:
                return self.send_error(e.code,'Meteomatics access or quota error')
            except (ValueError,KeyError,TypeError): return self.send_error(400)
            except OSError: return self.send_error(503)
            mime='application/json'
        else:
            files={'/observations.json':'observations.json','/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/weather.js':'weather.js','/output/thinned_fires.geojson':'output/thinned_fires.geojson'}
            for filename in ['italy.js','METHODS.txt','data/calendar.js','data/weeks.csv','data/inventory.csv']:
                files['/'+filename]=filename
            if re.fullmatch(r'/data/[0-9]{4}\.js',route.path) and (ROOT/route.path[1:]).is_file():
                files[route.path]=route.path[1:]
            for font in ['honk','space']:
                files['/fonts/'+font+'.ttf']='fonts/'+font+'.ttf'
            if route.path not in files:return self.send_error(404)
            file=ROOT/files[route.path]
            body=file.read_bytes()
            mime={'.json':'application/json','.html':'text/html','.css':'text/css','.js':'text/javascript','.ttf':'font/ttf','.txt':'text/plain','.csv':'text/csv','.geojson':'application/json'}[file.suffix]
        self.send_response(200); self.send_header('Content-Type',mime+'; charset=utf-8'); self.end_headers(); self.wfile.write(body)
if __name__=='__main__':
    credentials=login()
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    server.credentials=credentials
    url=f'http://127.0.0.1:{server.server_port}/'
    print('Local fire map:',url,flush=True)
    webbrowser.open(url)
    server.serve_forever()
