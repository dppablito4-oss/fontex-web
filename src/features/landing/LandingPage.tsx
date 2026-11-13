import { ArrowRight, ArrowUpRight, BookOpen, Check, FileText, Heart, PenTool, Sparkles } from "lucide-react";
import { SiteHeader } from "../../components/ProductNavigation";
import { BrandMark } from "../../components/BrandMark";
import { objectRegistry } from "../../core/object-registry/registry";
import { ParabolaHero } from "./ParabolaHero";
import "./landing.css";

const paths = [
  { number: "01", icon: PenTool, title: "Crea para entender", text: "Lleva una idea al lienzo. Cambia sus valores, observa el dibujo y construye una explicación paso a paso.", href: "#/lienzo", action: "Abrir el lienzo", className: "create" },
  { number: "02", icon: BookOpen, title: "Aprende a tu ritmo", text: "Elige tu nivel, explora una guía y comprueba lo que entendiste con ejercicios y pistas.", href: "#/demo", action: "Explorar las guías", className: "learn" },
  { number: "03", icon: FileText, title: "Dale sentido a tus fuentes", text: "Organiza tus documentos y consulta al tutor con referencias a tus lecturas. Disponible con una cuenta.", href: "#/biblioteca", action: "Ir a mi biblioteca", className: "sources" },
];
export function LandingPage() {
  return <div className="lp-page">
    <a className="skip-link" href="#lp-main" onClick={event => { event.preventDefault(); document.getElementById("lp-main")?.focus(); }}>Saltar al contenido</a>
    <SiteHeader />
    <main id="lp-main" tabIndex={-1}>
      <section className="lp-hero" aria-labelledby="lp-title">
        <div className="lp-hero-copy"><p className="lp-eyebrow"><span /> MATEMÁTICA, A LA VISTA</p>
          <h1 id="lp-title">Entender cambia<br />todo. <em>Empieza<br className="lp-title-break" /> por verlo.</em></h1>
          <p className="lp-lead">Una fórmula deja de ser solo símbolos cuando puedes ver cómo cambia. Explora, experimenta y aprende con tus propias ideas.</p>
          <div className="lp-actions"><a className="lp-button" href="#/lienzo">Crear en el lienzo<ArrowRight size={18} /></a><a className="lp-secondary" href="#/demo">Explorar guías<ArrowUpRight size={17} /></a></div>
          <p className="lp-reassurance"><Check size={15} /> Puedes empezar sin crear una cuenta.</p>
        </div>
        <ParabolaHero />
      </section>
      <div className="lp-facts" aria-label="Qué puedes explorar"><div><strong>{Object.keys(objectRegistry).length}</strong><span>módulos visuales<br />para experimentar</span></div><div><strong>De inicial<br />a universidad</strong><span>guías introductorias<br />según tu nivel</span></div><div><strong>A tu manera</strong><span>edita, practica, presenta<br />y exporta a PDF</span></div></div>
      <section className="lp-paths" aria-labelledby="lp-paths-title"><div className="lp-section-heading"><p className="lp-eyebrow">UN ESPACIO. VARIAS FORMAS DE APRENDER.</p><h2 id="lp-paths-title">¿Por dónde quieres empezar?</h2><p>Encuentra lo que necesitas, sin perderte entre herramientas.</p></div>
        <div className="lp-path-grid">{paths.map(({ number, icon: Icon, title, text, href, action, className }) => <a className={`lp-path lp-path-${className}`} href={href} key={number}><div className="lp-path-top"><Icon size={25} /><span>{number}</span></div><h3>{title}</h3><p>{text}</p><span className="lp-path-action">{action}<ArrowRight size={17} /></span></a>)}</div>
      </section>
      <section className="lp-process" aria-labelledby="lp-process-title"><div><p className="lp-eyebrow">MENOS PASOS. MÁS DESCUBRIMIENTOS.</p><h2 id="lp-process-title">De una pregunta<br />a un «ya entendí».</h2><p>No necesitas saber por dónde empezar.<br />Solo tener algo que quieras descubrir.</p><a className="lp-text-link" href="#/lienzo">Vamos al lienzo<ArrowUpRight size={17} /></a></div><ol>{[
        ["Elige una idea", "Fracciones, geometría, álgebra, estadística… Añade un módulo o parte de un ejemplo."],
        ["Hazla tuya", "Edita sobre el dibujo y mira qué cambia. Recorre la explicación o intenta resolverlo."],
        ["Comparte lo que descubriste", "Presenta tu material como una lección o llévalo a clase en un PDF."],
      ].map(([title, text], i) => <li key={title}><span>{i + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
      <section className="lp-levels" aria-labelledby="lp-levels-title"><p className="lp-eyebrow">CADA ETAPA TIENE SU PUNTO DE PARTIDA</p><h2 id="lp-levels-title">Pequeñas ideas. Nuevas conexiones.</h2><div>{[["inicial", "Inicial · 3 a 5 años"], ["primaria", "Primaria · 1.º a 6.º"], ["secundaria", "Secundaria · 1.º a 5.º"], ["universidad", "Universidad introductoria"]].map(([level, label]) => <a key={level} href={`#/demo?nivel=${level}`}>{label}<ArrowUpRight size={15} /></a>)}</div><p>Guías para dar el primer paso en cada nivel. El contenido seguirá creciendo.</p></section>
      <section className="lp-final"><Sparkles size={28} aria-hidden="true" /><h2>Tu próxima idea<br />merece un lienzo.</h2><a className="lp-button" href="#/lienzo">Empezar a crear<ArrowRight size={18} /></a><p>Sin instalaciones. Directamente en tu navegador.</p></section>
    </main>
    <footer className="lp-footer"><a href="#/" aria-label="Fontex, presentación"><BrandMark /></a><p>Para aprender mirando, haciendo y preguntando.</p><nav aria-label="Enlaces de la presentación"><a href="#/lienzo">Lienzo</a><a href="#/demo">Aprender</a><a href="#/ingresar">Tu cuenta</a><a href={`${import.meta.env.BASE_URL}notices/mathigon.txt`} target="_blank" rel="noopener noreferrer">Créditos<ArrowUpRight size={12} /></a></nav><small className="lp-footer-meta"><span>© {new Date().getFullYear()} Fontex</span><span className="lp-creator-credit">Creado con <Heart size={11} fill="currentColor" aria-label="amor" /> por <strong>Samuel Pablo Claudio</strong><span aria-hidden="true">·</span><a href="https://space.sypablitodp.site" target="_blank" rel="noopener noreferrer">space.sypablitodp.site</a><span aria-hidden="true">·</span><a href="https://wa.me/51918165428" target="_blank" rel="noopener noreferrer">WhatsApp: 918 165 428</a></span></small></footer>
  </div>;
}
