import { useEffect, useState } from 'react';
import type { Place } from '../types';

// Palabras clave temáticas para el 2º intento (foto en línea relacionada).
const KEYWORDS: Record<string, string> = {
  'torre-eiffel': 'eiffeltower,paris',
  'machu-picchu': 'machupicchu,peru',
  'gran-muralla': 'greatwall,china',
  'estatua-libertad': 'statueofliberty,newyork',
  'piramides-giza': 'pyramids,egypt',
  coliseo: 'colosseum,rome',
  'sagrada-familia': 'barcelona,cathedral',
  'monte-fuji': 'mountfuji,japan',
  'cataratas-iguazu': 'iguazu,waterfall',
  'opera-sidney': 'sydney,operahouse',
  'chichen-itza': 'chichenitza,mexico',
  'taj-mahal': 'tajmahal,india',
  'cristo-redentor': 'riodejaneiro,christ',
  santorini: 'santorini,greece',
  'gran-canon': 'grandcanyon,arizona',
  'big-ben': 'bigben,london',
  'times-square': 'timessquare,newyork',
  'burj-khalifa': 'dubai,skyscraper',
  maldivas: 'maldives,beach',
  matterhorn: 'matterhorn,alps',
  'torres-del-paine': 'patagonia,mountains',
  seljalandsfoss: 'iceland,waterfall',
  niagara: 'niagara,waterfall',
  'sahara-merzouga': 'sahara,desert',
  'arco-triunfo': 'paris,arcdetriomphe',
  'zona-colonial': 'santodomingo,colonial',
  'punta-cana': 'puntacana,beach',
  'bahia-aguilas': 'caribbean,beach',
  'pico-duarte': 'caribbean,mountains',
  'salar-uyuni': 'uyuni,saltflat',
  cartagena: 'cartagena,colombia',
  'perito-moreno': 'glacier,patagonia',
  'plaza-roja': 'moscow,redsquare',
  'lago-baikal': 'baikal,lake',
  'salvador-sangre': 'saintpetersburg,church',
  'aurora-tromso': 'tromso,aurora',
  'lago-moraine': 'moraine,canada',
  acropolis: 'athens,acropolis',
  'santa-sofia': 'istanbul,mosque',
  'montana-mesa': 'capetown,tablemountain',
  amboseli: 'kenya,safari',
  petra: 'petra,jordan',
  'angkor-wat': 'angkor,cambodia',
  neuschwanstein: 'bavaria,castle',
  hallstatt: 'hallstatt,austria',
};

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  place: Place;
  // Ancho solicitado a Unsplash: las tarjetas usan 600, el modal 1200.
  w?: number;
}

// Imagen con cadena de respaldo: Unsplash → LoremFlickr temático → Picsum.
// Por qué: si un ID de Unsplash muere (404), la tarjeta nunca queda rota.
export default function PlaceImage({ place, alt, w = 1200, ...rest }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
  }, [place.id, place.imageUrl, w]);

  // Reescribe el ancho pedido al CDN (las tarjetas se ven a ~300 px).
  const primary = place.imageUrl.includes('images.unsplash.com')
    ? place.imageUrl.replace(/([?&])w=\d+/, `$1w=${w}`)
    : place.imageUrl;

  const sources = [
    primary,
    `https://loremflickr.com/1200/800/${KEYWORDS[place.id] ?? 'travel,landmark'}`,
    `https://picsum.photos/seed/geovista-${place.id}/1200/800`,
  ];
  const src = sources[Math.min(step, sources.length - 1)];

  return (
    <img
      {...rest}
      src={src}
      alt={alt ?? place.name}
      decoding="async"
      onError={() => setStep((s) => Math.min(s + 1, sources.length - 1))}
    />
  );
}
