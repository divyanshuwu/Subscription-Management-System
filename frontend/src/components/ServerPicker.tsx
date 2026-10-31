import {useEffect,useState} from 'react';
import {request} from '../data';
type Option={id:string;name:string;company?:string;email?:string};
// Uses existing field/input/select styles; only fetches a bounded search result.
export function ServerPicker({endpoint,name,label,initial,onSelect}: {endpoint:string;name:string;label:string;initial:Option[];onSelect?:(id:string)=>void}){
 const [search,setSearch]=useState(''),[options,setOptions]=useState(initial),[selected,setSelected]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let cancelled=false;const timer=setTimeout(()=>{void request(`${endpoint}?search=${encodeURIComponent(search)}&page_size=50`).then(r=>{if(!cancelled){setOptions(r.data);setError('');}}).catch(e=>{if(!cancelled)setError(e.message);});},180);return()=>{cancelled=true;clearTimeout(timer);};},[endpoint,search]);
 return <label className="field"><span>{label}</span><input aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}…`} value={search} onChange={e=>setSearch(e.target.value)}/><select name={name} required value={selected} onChange={e=>{setSelected(e.target.value);onSelect?.(e.target.value);}}><option value="" disabled>Select {label.toLowerCase()}</option>{options.map(o=><option key={o.id} value={o.id}>{o.company||o.name}{o.email?` · ${o.email}`:''}</option>)}</select>{error&&<small role="alert">{error}</small>}</label>;
}
