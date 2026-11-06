'use client';
import { useEffect, useMemo, useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import RankingRow, { RankPlayer } from '@/components/RankingRow';
import PodiumRow from '@/components/PodiumRow';
import FiltersBar from '@/components/FiltersBar';
import InfoCard from '@/components/InfoCard';
import Pagination from '@/components/Pagination';

const fallback: RankPlayer[] = [
 {id:1,ranking:1,gamerTag:'ÑEMBO',sponsor:'RZS',character:'Yasuo + Samira + Fuse',points:890},
 {id:2,ranking:2,gamerTag:'GAPPY',sponsor:'TKF',character:'Blitzcrank + Braum',points:740},
 {id:3,ranking:3,gamerTag:'HIAMJOY',sponsor:'HCN',character:'Darius + Illaoi',points:620},
 {id:4,ranking:4,gamerTag:'MIKU',sponsor:'FKC',character:'Ahri + Ekko',points:560},
 {id:5,ranking:5,gamerTag:'KIRITO',sponsor:'RZS',character:'Yasuo + Ekko',points:510},
 {id:6,ranking:6,gamerTag:'SENPAI',character:'Jinx + Vi',points:480},
 {id:7,ranking:7,gamerTag:'NOVA',sponsor:'HCN',character:'Caitlyn + Lux',points:445},
 {id:8,ranking:8,gamerTag:'ZETA',character:'Akali + Senna',points:420},
 {id:9,ranking:9,gamerTag:'BANEADO',sponsor:'FKC',character:'Sett + Darius',points:390},
 {id:10,ranking:10,gamerTag:'KUMA',character:'Braum + Warwick',points:360},
 {id:11,ranking:11,gamerTag:'RAVEN',character:'Thresh + Samira',points:330},
 {id:12,ranking:12,gamerTag:'ORBIT',character:'Lux + Ahri',points:300},
];

export default function Home() {
 const [players,setPlayers]=useState<RankPlayer[]>([]); const [loading,setLoading]=useState(true); const [syncing,setSyncing]=useState(false); const [page,setPage]=useState(1); const [from,setFrom]=useState(1); const [to,setTo]=useState(10);
 useEffect(()=>{ const url=process.env.NEXT_PUBLIC_API_URL; fetch(`${url || 'http://localhost:8080'}/api/rankings/2xko?from=${from}&to=${to}`).then(r=>r.ok?r.json():[]).then(data=>setPlayers(Array.isArray(data)&&data.length?data.sort((a:RankPlayer,b:RankPlayer)=>a.ranking-b.ranking):fallback)).catch(()=>setPlayers(fallback)).finally(()=>setLoading(false)); },[from,to]);
 const list=useMemo(()=>players.length?players:fallback,[players]); const total=Math.max(1,Math.ceil(list.length/10)); const shown=list.slice((page-1)*10,page*10); const podium=page===1?shown.slice(0,3):[]; const rows=page===1?shown.slice(3):shown;
 return <div className="app-shell"><SiteHeader/><main className="site-main"><div className="content-column"><div className="hero"><div><span className="eyebrow">HOT COFFEE · 2XKO</span><h1>HOT COFFEE <em>2XKO</em><br/><span>RANKING</span></h1><p>LA CLASIFICACIÓN COMPETITIVA DE LA COMUNIDAD.</p></div><div className="live-pill"><i/> {loading?'CARGANDO':'EN VIVO'}</div></div><FiltersBar from={from} to={to} onFrom={n=>{setFrom(n);setPage(1)}} onTo={n=>{setTo(n);setPage(1)}} syncing={syncing} onSync={()=>{setSyncing(true);setTimeout(()=>setSyncing(false),1200)}}/><section className="ranking-board"><div className="board-heading"><div><span className="eyebrow">TOP 3 · TEMPORADA ACTUAL</span><h2>LOS QUE MANDAN</h2></div><span className="board-count">{list.length} JUGADORES</span></div><div className="podium-list">{podium.map(p=><PodiumRow key={p.ranking} player={p}/>)}</div><div className="list-heading"><span>POSICIÓN / JUGADOR</span><span>EQUIPO</span><span>PUNTOS</span></div><div className="ranking-list">{loading?[1,2,3,4].map(i=><div key={i} className="skeleton-row"/>):rows.length?rows.map(p=><RankingRow key={p.ranking} player={p}/>):<div className="empty-state">NO HAY JUGADORES EN ESTE RANGO.</div>}</div><div className="board-footer"><span>10 POR PÁGINA</span><Pagination page={page} total={total} onChange={setPage}/></div></section></div><aside className="sidebar"><InfoCard eyebrow="RESUMEN" title="TEMPORADA"><div className="stat-line"><span>PARTICIPANTES</span><b>{list.length || 56}</b></div><div className="stat-line"><span>TORNEOS REGISTRADOS</span><b>22</b></div></InfoCard><InfoCard eyebrow="EN LA CIMA" title="JUGADOR DESTACADO"><div className="featured"><div className="featured-avatar"><img src="/logo-Hot.jpg" alt=""/></div><div><strong>{list[0]?.gamerTag || 'ÑEMBO'}</strong><span>{list[0]?.points || 890} PTS · PUESTO #1</span></div></div></InfoCard><div className="discord-card"><span className="eyebrow">COMUNIDAD</span><h2>ENTRA AL LOBBY</h2><p>RANKED, TORNEOS Y CAFÉ PARA TODOS.</p><a href="https://discord.com" target="_blank" rel="noreferrer">UNIRSE AL DISCORD</a></div></aside></main><footer><span>HOT COFFEE 2XKO</span><span>DEV: <b>LYCAN</b></span></footer></div>
}
