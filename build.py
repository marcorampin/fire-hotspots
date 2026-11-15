"""Usage: python build.py Italy.zip [coverage.csv]. Requires numpy and pandas."""
from pathlib import Path
from zipfile import ZipFile
from io import BytesIO
import sys,json,datetime as dt,calendar
import numpy as np
import pandas as pd
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'data';OUT.mkdir(exist_ok=True)
# Exact 10 km squares on a spherical sinusoidal equal-area projection, central meridian 12E.
def grid(lat,lon):
    y=np.radians(lat);return np.floor(6371007.181*np.radians(lon-12)*np.cos(y)/10000).astype(int).astype(str)+':'+np.floor(6371007.181*y/10000).astype(int).astype(str)
frames=[]; inventory=[]
with ZipFile(sys.argv[1]) as outer:
 for member in outer.namelist():
  with ZipFile(BytesIO(outer.read(member))) as inner:
   for name in inner.namelist():
    if not name.endswith('.csv'):continue
    d=pd.read_csv(inner.open(name),dtype=str)
    inventory.append([name,len(d),d.acq_date.min(),d.acq_date.max()])
    if 'archive' not in name or not ('_M-C' in name or '_SV-C' in name):continue
    sensor='M' if '_M-C' in name else 'V'
    good=d.confidence.astype(float).ge(30) if sensor=='M' else d.confidence.isin(['n','h'])
    d=d[good & d.type.eq('0')].copy()
    d['sensor']=sensor;d['cell']=grid(d.latitude.astype(float),d.longitude.astype(float))
    dates=pd.to_datetime(d.acq_date);d['week']=(dates-pd.to_timedelta(dates.dt.weekday,unit='D')).dt.strftime('%Y-%m-%d')
    frames.append(d)
d=pd.concat(frames,ignore_index=True)
pd.DataFrame(inventory,columns=['file','rows','first_detection','last_detection']).to_csv(OUT/'inventory.csv',index=False)
counts=d.groupby(['week','sensor']).cell.nunique().unstack()
# Missing detection weeks inside product bounds have zero records; observation opportunity remains unknown.
for sensor,needle in [('M','archive_M-'),('V','archive_SV-')]:
 row=next(v for v in inventory if needle in v[0])
 starts=pd.date_range(row[2],pd.Timestamp(row[3])-pd.Timedelta(days=6),freq='W-MON').strftime('%Y-%m-%d')
 counts=counts.reindex(counts.index.union(starts));counts.loc[starts,sensor]=counts.loc[starts,sensor].fillna(0)
 counts.loc[~counts.index.isin(starts),sensor]=np.nan
counts=counts.sort_index();counts.index.name='week'
train=counts.loc['2013':'2020-12-21'].dropna();test=counts.loc['2021':'2025-12-22'].dropna()
factor=float((train.M*train.V).sum()/(train.M**2).sum())
counts['A']=(counts.M*factor).round(1)
err=test.M*factor-test.V
metrics=dict(factor=factor,training=len(train),testing=len(test),rawMAE=float(abs(test.M-test.V).mean()),adjustedMAE=float(abs(err).mean()),bias=float(err.mean()))
# Optional matched observation denominator. One row per adequately observed cell, sensor and Monday.
# Coverage producer must use the same Italy footprint, grid, and documented weekly adequacy threshold.
cov={}
if len(sys.argv)>2:
 c=pd.read_csv(sys.argv[2],dtype=str)
 if c.duplicated(['week','sensor','cell']).any() or not c.sensor.isin(['M','V']).all():raise ValueError('Invalid coverage keys')
 keys=['week','sensor','cell'];det=d[keys].drop_duplicates().assign(hit=1)
 for (w,s),g in c.merge(det,on=keys,how='left').groupby(['week','sensor']):
    cov[w+s]=[int(g.hit.sum()),len(g)]
records=[]
for w,row in counts.iterrows():
 date=dt.date.fromisoformat(w);iy,iw,_=date.isocalendar()
 record={'week':w,'year':iy,'slot':iw}
 for s in 'MVA':
    val=row[s];record[s]=None if pd.isna(val) else float(val)
    h=[v[s] for v in records if 0<iy-v['year']<=10 and min(abs(iw-v['slot']),52-abs(iw-v['slot']))<=2 and v[s] is not None]
    years={v['year'] for v in records if 0<iy-v['year']<=10 and abs(iw-v['slot'])<=2 and v[s] is not None}
    record[s+'range']=[round(float(x),1) for x in np.quantile(h,[.1,.5,.9])] if len(years)>=3 else None
    record[s+'coverage']=cov.get(w+('M' if s=='A' else s))
    # For flags compare observed fractions on adequately surveyed weeks only; require denominator >=80% of fixed study footprint.
    record[s+'flag']=None
    if s!='A' and w+s in cov and 'study_cells' in c:
        total=pd.to_numeric(c.study_cells).unique()
        if len(total)!=1 or total[0]<=0:raise ValueError('Expected constant positive study_cells')
        hits,n=cov[w+s];record[s+'eligible']=n>=.8*total[0]
        prior=[v for v in records if v.get(s+'eligible') and 0<iy-v['year']<=10 and abs(iw-v['slot'])<=2]
        if record[s+'eligible'] and len({v['year'] for v in prior})>=3:
            record[s+'flag']=bool(hits/n>np.quantile([v[s+'coverage'][0]/v[s+'coverage'][1] for v in prior],.9))
 records.append(record)
pd.DataFrame(records).to_csv(OUT/'weeks.csv',index=False)
(OUT/'calendar.js').write_text('window.ITALY='+json.dumps({'weeks':records,'metrics':metrics},separators=(',',':'))+';',encoding='utf8')
for yr,g in d.groupby(d.week.str[:4]):
 weeks={}
 for w,group in g.groupby('week'):
    weeks[w]=[[round(float(a),5),round(float(b),5),s,t+'T'+v.zfill(4)[:2]+':'+v.zfill(4)[2:]+'Z',sat] for a,b,s,t,v,sat in group[['latitude','longitude','sensor','acq_date','acq_time','satellite']].itertuples(index=False,name=None)]
 (OUT/(yr+'.js')).write_text('window.ITALY_POINTS['+yr+']='+json.dumps(weeks,separators=(',',':'))+';',encoding='utf8')
print(metrics,flush=True)
