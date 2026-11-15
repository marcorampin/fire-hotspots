"""Run after the archive-based build.py, or against the packaged comparison data."""
from pathlib import Path
import pandas as pd,numpy as np,json,sys
root=Path(__file__).resolve().parent/'data'
d=pd.read_csv(sys.argv[1],dtype={'confidence':str})
c=pd.to_numeric(d.confidence,errors='coerce')
assert c.dropna().between(30,100).all()
assert d.loc[c.isna(),'confidence'].isin(['n','h']).all()
assert d.notna().all().all() and d.latitude.between(-90,90).all() and d.longitude.between(-180,180).all() and d.n_merged.ge(1).all()
date=pd.to_datetime(d.acq_date,format='%Y-%m-%d')
d['week']=(date-pd.to_timedelta(date.dt.weekday,unit='D')).dt.strftime('%Y-%m-%d')
lat=np.radians(d.latitude);x=6371007.181*np.radians(d.longitude-12)*np.cos(lat);y=6371007.181*lat
d['cell']=np.floor(x/10000).astype(int).astype(str)+':'+np.floor(y/10000).astype(int).astype(str)
g=d.groupby('week').agg(H=('cell','nunique'),rows=('cell','size'),members=('n_merged','sum'))
src=root/'calendar.js';obj=json.loads(src.read_text().split('=',1)[1][:-1]);records={w['week']:w for w in obj['weeks']}
weeks=pd.date_range(d.week.min(),d.week.max(),freq='W-MON')
for stamp in weeks:
 w=stamp.strftime('%Y-%m-%d');yr,slot,_=stamp.isocalendar()
 rec=records.setdefault(w,dict(week=w,year=yr,slot=slot))
 for s in 'MVA': rec.setdefault(s,None)
 rec.update({k:int(g.loc[w,k]) if w in g.index else 0 for k in ['H','rows','members']})
 rec['partial']=w<d.acq_date.min() or (stamp+pd.Timedelta(days=6)).strftime('%Y-%m-%d')>d.acq_date.max()
previous=[]
for rec in sorted(records.values(),key=lambda v:v['week']):
 rec.setdefault('H',None);rec['Hcoverage']=rec['Hflag']=rec['Hrange']=None
 hist=[p for p in previous if 0<rec['year']-p['year']<=10 and min(abs(rec['slot']-p['slot']),53-abs(rec['slot']-p['slot']))<=2]
 if len({p['year'] for p in hist})>=3:rec['Hrange']=np.quantile([p['H'] for p in hist],[.1,.5,.9]).round(1).tolist()
 if rec['H'] is not None and not rec['partial']:previous.append(rec)
obj['weeks']=sorted(records.values(),key=lambda v:v['week'])
src.write_text('window.ITALY='+json.dumps(obj,separators=(',',':'))+';')
pd.DataFrame(obj['weeks']).to_csv(root/'weeks.csv',index=False)
for yr,group in d.groupby(d.week.str[:4]):
 path=root/(yr+'.js');content=json.loads(path.read_text().split('=',1)[1][:-1]) if path.exists() else {}
 for w in content:content[w]=[p for p in content[w] if p[2]!='H']
 for w,rows in group.groupby('week'):
  content.setdefault(w,[]).extend([[a,b,'H',date,conf,frp,int(n)] for a,b,date,conf,frp,n in rows[['latitude','longitude','acq_date','confidence','frp','n_merged']].itertuples(index=False,name=None)])
 path.write_text('window.ITALY_POINTS['+yr+']='+json.dumps(content,separators=(',',':'))+';')
assert sum(v.get('rows',0) for v in obj['weeks'])==len(d)
print('date bounds',d.acq_date.min(),d.acq_date.max(),'contributors',d.n_merged.sum(),'confidence',c.min(),c.max(),d.loc[c.isna(),'confidence'].value_counts().to_dict(), 'weeks',len(weeks))
