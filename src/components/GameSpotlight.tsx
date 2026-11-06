import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export default function GameSpotlight() {
  return (
    <section id="juego" className="game-spotlight" aria-labelledby="game-spotlight-title">
      <div className="spotlight-art" aria-hidden="true">
        <Image
          src="/fighters/Yasuo.png"
          alt=""
          fill
          priority
          sizes="(max-width: 800px) 100vw, (max-width: 1280px) 70vw, 760px"
        />
      </div>
      <div className="spotlight-shade" aria-hidden="true" />

      <div className="spotlight-copy">
        <div className="spotlight-meta">
          <span className="spotlight-status"><i aria-hidden="true" /> JUEGO DESTACADO</span>
          <span className="spotlight-edition">RIOT GAMES <b>·</b> 2XKO</span>
        </div>
        <h2 id="game-spotlight-title"><span>DUOS EN</span><strong>2XKO</strong></h2>
        <p>EL JUEGO DE PELEA POR PAREJAS QUE MUEVE A NUESTRA COMUNIDAD.</p>

        <div className="spotlight-badges" aria-label="Temas destacados">
          <span>NOVEDADES</span>
          <span>TIER LISTS</span>
          <span>GUÍAS</span>
        </div>

        <Link className="spotlight-cta" href="#ranking">
          VER CLASIFICACIÓN <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>

      <span className="spotlight-index" aria-hidden="true">HOT COFFEE / 02</span>
    </section>
  );
}
