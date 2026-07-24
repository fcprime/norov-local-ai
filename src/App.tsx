import { useEffect, useMemo, useRef, useState } from 'react';
import { companies as initialCompanies } from './mockData';
import { generateAiOutreach, searchCompanies, type OutreachPack } from './api';
import AdminPanel from './AdminPanel';
import { supabase, type Profile } from './supabase';
import type { Channel, Company, LeadActivity, LeadStatus, SearchFilters } from './types';

const statuses: LeadStatus[] = [
  'New',
  'Contacted',
  'Replied',
  'Interested',
  'Quote Sent',
  'Negotiation',
  'Won',
  'Lost',
];

const channels: Channel[] = [
  'Email',
  'WhatsApp',
  'Facebook',
  'Instagram',
  'LinkedIn',
  'SMS',
  'Call Script',
  'Follow-up 1',
  'Follow-up 2',
];

const countries = [
  'Austria',
  'Belgium',
  'Bulgaria',
  'Croatia',
  'Cyprus',
  'Czechia',
  'Denmark',
  'Estonia',
  'Finland',
  'France',
  'Germany',
  'Greece',
  'Hungary',
  'Ireland',
  'Italy',
  'Latvia',
  'Lithuania',
  'Luxembourg',
  'Malta',
  'Netherlands',
  'Poland',
  'Portugal',
  'Romania',
  'Slovakia',
  'Slovenia',
  'Spain',
  'Sweden',
  'United Kingdom',
  'United States',
  'Canada',
  'Australia',
  'New Zealand',
  'Norway',
  'Switzerland',
  'Iceland',
  'Ukraine',
];

const countryLanguage: Record<string, string> = {
  Austria: 'Deutsch',
  Belgium: 'Nederlands / Français',
  Bulgaria: 'Български',
  Croatia: 'Hrvatski',
  Cyprus: 'Ελληνικά / English',
  Czechia: 'Čeština',
  Denmark: 'Dansk',
  Estonia: 'Eesti',
  Finland: 'Suomi / Svenska',
  France: 'Français',
  Germany: 'Deutsch',
  Greece: 'Ελληνικά',
  Hungary: 'Magyar',
  Ireland: 'English',
  Italy: 'Italiano',
  Latvia: 'Latviešu',
  Lithuania: 'Lietuvių',
  Luxembourg: 'Français / Deutsch',
  Malta: 'Malti / English',
  Netherlands: 'Nederlands',
  Poland: 'Polski',
  Portugal: 'Português',
  Romania: 'Română',
  Slovakia: 'Slovenčina',
  Slovenia: 'Slovenščina',
  Spain: 'Español',
  Sweden: 'Svenska',
  'United Kingdom': 'English',
  'United States': 'English (US)',
  Canada: 'English (Canada)',
  Australia: 'English',
  'New Zealand': 'English',
  Norway: 'Norsk',
  Switzerland: 'Deutsch / Français / Italiano',
  Iceland: 'Íslenska',
  Ukraine: 'Українська',
};

const targetSegments = [
  'Готелі та хостели',
  'Офіси та коворкінги',
  'Ресторани та кафе',
  'Клініки та стоматології',
  'Салони краси та перукарні',
  'Дитячі центри',
  'Автосалони та автосервіси',
  'Спортзали та фітнес-клуби',
  'Школи та навчальні центри',
  'Магазини меблів та інтер’єру',
  'Торгові центри та магазини',
  'Івент-зали та розважальні заклади',
  'Заводи, склади та виробництва',
  'Апартаменти та об’єкти розміщення',
  'Туристичні об’єкти',
];

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function editDistance(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i++) matrix[i][0] = i;
  for (let j = 0; j < cols; j++) matrix[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return matrix[a.length][b.length];
}

function cityMatches(companyCity: string, query: string) {
  if (!query.trim()) return true;
  const a = normalizeText(companyCity);
  const b = normalizeText(query);
  return a.includes(b) || b.includes(a) || editDistance(a, b) <= 2;
}

function normalizeStatus(status: string): LeadStatus {
  const migrations: Record<string, LeadStatus> = {
    Callback: 'Contacted',
    Meeting: 'Negotiation',
    Client: 'Won',
    Declined: 'Lost',
  };
  return (
    migrations[status] ?? (statuses.includes(status as LeadStatus) ? (status as LeadStatus) : 'New')
  );
}

function normalizeCompany(company: Company): Company {
  return {
    ...company,
    status: normalizeStatus(company.status),
    activities: company.activities || [],
  };
}

function mergeSavedCompanies(saved: Company[]): Company[] {
  const byId = new Map<string, Company>(
    saved.map((company) => {
      const normalized = normalizeCompany(company);
      return [normalized.id, normalized];
    }),
  );
  for (const company of initialCompanies) {
    if (!byId.has(company.id)) byId.set(company.id, normalizeCompany(company));
  }
  return Array.from(byId.values());
}

type MessageStyle = 'standard' | 'short' | 'polite' | 'trust' | 'soft';

const languageCode: Record<string, string> = {
  Polski: 'pl',
  Español: 'es',
  English: 'en',
  'English (US)': 'en',
  'English (Canada)': 'en',
  Deutsch: 'de',
  Français: 'fr',
  Nederlands: 'nl',
  Italiano: 'it',
  Português: 'pt',
  Română: 'ro',
  Čeština: 'cs',
  'Nederlands / Français': 'nl',
  'Deutsch / Français / Italiano': 'de',
  'Ελληνικά / English': 'en',
  'Suomi / Svenska': 'en',
  'Malti / English': 'en',
  'Українська': 'uk',
};

function preferredLanguage(company: Company) {
  const raw = company.language || countryLanguage[company.country] || 'English';
  return raw.includes('/') ? raw.split('/')[0].trim() : raw;
}


const localizedTerms: Record<string, Record<string, string>> = {
  uk: {
    'хімчистка меблів': 'хімчистка меблів',
    'чистка меблів': 'чистка меблів',
    'прання диванів': 'прання диванів',
    'готелі та хостели': 'готелі та хостели',
    'офіси та коворкінги': 'офіси та коворкінги',
    'ресторани та кафе': 'ресторани та кафе',
    'клініки та стоматології': 'клініки та стоматології',
    'салони краси та перукарні': 'салони краси та перукарні',
    'дитячі центри': 'дитячі центри',
    'автосалони та автосервіси': 'автосалони та автосервіси',
    'спортзали та фітнес-клуби': 'спортзали та фітнес-клуби',
    'школи та навчальні центри': 'школи та навчальні центри',
    'магазини меблів та інтер’єру': 'магазини меблів та інтер’єру',
    'торгові центри та магазини': 'торгові центри та магазини',
    'івент-зали та розважальні заклади': 'івент-зали та розважальні заклади',
    'заводи, склади та виробництва': 'заводи, склади та виробництва',
    'апартаменти та об’єкти розміщення': 'апартаменти та об’єкти розміщення',
    'туристичні об’єкти': 'туристичні об’єкти',
  },
  pl: {
    'хімчистка меблів': 'pranie tapicerki meblowej',
    'чистка меблів': 'czyszczenie tapicerki meblowej',
    'прання диванів': 'pranie kanap',
    'готелі та хостели': 'hotele i hostele',
    'офіси та коворкінги': 'biura i coworkingi',
    'ресторани та кафе': 'restauracje i kawiarnie',
    'клініки та стоматології': 'kliniki i gabinety stomatologiczne',
    'салони краси та перукарні': 'salony kosmetyczne i fryzjerskie',
    'дитячі центри': 'centra dla dzieci',
    'автосалони та автосервіси': 'salony i serwisy samochodowe',
    'спортзали та фітнес-клуби': 'siłownie i kluby fitness',
    'школи та навчальні центри': 'szkoły i centra edukacyjne',
    'магазини меблів та інтер’єру': 'sklepy meblowe i wyposażenia wnętrz',
    'торгові центри та магазини': 'centra handlowe i sklepy',
    'івент-зали та розважальні заклади': 'sale eventowe i obiekty rozrywkowe',
    'заводи, склади та виробництва': 'zakłady, magazyny i obiekty produkcyjne',
    'апартаменти та об’єкти розміщення': 'apartamenty i obiekty noclegowe',
    'туристичні об’єкти': 'obiekty turystyczne',
  },
  en: {
    'хімчистка меблів': 'upholstery cleaning',
    'чистка меблів': 'upholstery cleaning',
    'прання диванів': 'sofa cleaning',
    'готелі та хостели': 'hotels and hostels',
    'офіси та коворкінги': 'offices and coworking spaces',
    'ресторани та кафе': 'restaurants and cafés',
    'клініки та стоматології': 'clinics and dental practices',
    'салони краси та перукарні': 'beauty salons and hairdressers',
    'дитячі центри': 'children’s centres',
    'автосалони та автосервіси': 'car dealerships and service centres',
    'спортзали та фітнес-клуби': 'gyms and fitness clubs',
    'школи та навчальні центри': 'schools and training centres',
    'магазини меблів та інтер’єру': 'furniture and interior stores',
    'торгові центри та магазини': 'shopping centres and stores',
    'івент-зали та розважальні заклади': 'event venues and entertainment businesses',
    'заводи, склади та виробництва': 'factories, warehouses and production facilities',
    'апартаменти та об’єкти розміщення': 'apartments and accommodation businesses',
    'туристичні об’єкти': 'tourist businesses',
  },
  de: {
    'хімчистка меблів': 'Polsterreinigung',
    'чистка меблів': 'Polsterreinigung',
    'прання диванів': 'Sofareinigung',
    'готелі та хостели': 'Hotels und Hostels',
    'офіси та коворкінги': 'Büros und Coworking-Spaces',
    'ресторани та кафе': 'Restaurants und Cafés',
    'клініки та стоматології': 'Kliniken und Zahnarztpraxen',
    'салони краси та перукарні': 'Kosmetik- und Friseursalons',
    'дитячі центри': 'Kinderzentren',
    'автосалони та автосервіси': 'Autohäuser und Werkstätten',
    'спортзали та фітнес-клуби': 'Fitnessstudios und Fitnessclubs',
    'школи та навчальні центри': 'Schulen und Bildungszentren',
    'магазини меблів та інтер’єру': 'Möbel- und Einrichtungsgeschäfte',
    'торгові центри та магазини': 'Einkaufszentren und Geschäfte',
    'івент-зали та розважальні заклади': 'Eventlocations und Freizeiteinrichtungen',
    'заводи, склади та виробництва': 'Fabriken, Lager und Produktionsbetriebe',
    'апартаменти та об’єкти розміщення': 'Apartments und Beherbergungsbetriebe',
    'туристичні об’єкти': 'Tourismusbetriebe',
  },
  fr: {
    'хімчистка меблів': 'nettoyage de meubles rembourrés',
    'чистка меблів': 'nettoyage de meubles',
    'прання диванів': 'nettoyage de canapés',
    'готелі та хостели': 'hôtels et auberges',
    'офіси та коворкінги': 'bureaux et espaces de coworking',
    'ресторани та кафе': 'restaurants et cafés',
    'клініки та стоматології': 'cliniques et cabinets dentaires',
    'салони краси та перукарні': 'instituts de beauté et salons de coiffure',
    'дитячі центри': 'centres pour enfants',
    'автосалони та автосервіси': 'concessions et garages automobiles',
    'спортзали та фітнес-клуби': 'salles de sport et clubs de fitness',
    'школи та навчальні центри': 'écoles et centres de formation',
    'магазини меблів та інтер’єру': 'magasins de meubles et de décoration',
    'торгові центри та магазини': 'centres commerciaux et magasins',
    'івент-зали та розважальні заклади': 'salles événementielles et établissements de loisirs',
    'заводи, склади та виробництва': 'usines, entrepôts et sites de production',
    'апартаменти та об’єкти розміщення': 'appartements et hébergements',
    'туристичні об’єкти': 'établissements touristiques',
  },
  nl: {
    'хімчистка меблів': 'meubel- en bekledingsreiniging',
    'чистка меблів': 'meubelreiniging',
    'прання диванів': 'bankreiniging',
    'готелі та хостели': 'hotels en hostels',
    'офіси та коворкінги': 'kantoren en coworkingruimtes',
    'ресторани та кафе': 'restaurants en cafés',
    'клініки та стоматології': 'klinieken en tandartspraktijken',
    'салони краси та перукарні': 'schoonheidssalons en kapperszaken',
    'дитячі центри': 'kindercentra',
    'автосалони та автосервіси': 'autodealers en garages',
    'спортзали та фітнес-клуби': 'sportscholen en fitnessclubs',
    'школи та навчальні центри': 'scholen en opleidingscentra',
    'магазини меблів та інтер’єру': 'meubel- en interieurwinkels',
    'торгові центри та магазини': 'winkelcentra en winkels',
    'івент-зали та розважальні заклади': 'evenementenlocaties en entertainmentbedrijven',
    'заводи, склади та виробництва': 'fabrieken, magazijnen en productiebedrijven',
    'апартаменти та об’єкти розміщення': 'appartementen en accommodaties',
    'туристичні об’єкти': 'toeristische bedrijven',
  },
  es: {
    'хімчистка меблів': 'limpieza de tapicería',
    'чистка меблів': 'limpieza de muebles',
    'прання диванів': 'limpieza de sofás',
    'готелі та хостели': 'hoteles y hostales',
    'офіси та коворкінги': 'oficinas y espacios de coworking',
    'ресторани та кафе': 'restaurantes y cafeterías',
    'клініки та стоматології': 'clínicas y consultas dentales',
    'салони краси та перукарні': 'salones de belleza y peluquerías',
    'дитячі центри': 'centros infantiles',
    'автосалони та автосервіси': 'concesionarios y talleres',
    'спортзали та фітнес-клуби': 'gimnasios y clubes de fitness',
    'школи та навчальні центри': 'escuelas y centros de formación',
    'магазини меблів та інтер’єру': 'tiendas de muebles e interiorismo',
    'торгові центри та магазини': 'centros comerciales y tiendas',
    'івент-зали та розважальні заклади': 'salones de eventos y negocios de ocio',
    'заводи, склади та виробництва': 'fábricas, almacenes y centros de producción',
    'апартаменти та об’єкти розміщення': 'apartamentos y alojamientos',
    'туристичні об’єкти': 'negocios turísticos',
  },
  it: {
    'хімчистка меблів': 'pulizia della tappezzeria',
    'чистка меблів': 'pulizia dei mobili',
    'прання диванів': 'pulizia dei divani',
    'готелі та хостели': 'hotel e ostelli',
    'офіси та коворкінги': 'uffici e spazi di coworking',
    'ресторани та кафе': 'ristoranti e caffè',
    'клініки та стоматології': 'cliniche e studi dentistici',
    'салони краси та перукарні': 'centri estetici e parrucchieri',
    'дитячі центри': 'centri per bambini',
    'автосалони та автосервіси': 'concessionarie e officine',
    'спортзали та фітнес-клуби': 'palestre e centri fitness',
    'школи та навчальні центри': 'scuole e centri di formazione',
    'магазини меблів та інтер’єру': 'negozi di mobili e arredamento',
    'торгові центри та магазини': 'centri commerciali e negozi',
    'івент-зали та розважальні заклади': 'location per eventi e strutture di intrattenimento',
    'заводи, склади та виробництва': 'fabbriche, magazzini e siti produttivi',
    'апартаменти та об’єкти розміщення': 'appartamenti e strutture ricettive',
    'туристичні об’єкти': 'attività turistiche',
  },
  pt: {
    'хімчистка меблів': 'limpeza de estofos',
    'чистка меблів': 'limpeza de mobili',
    'прання диванів': 'limpeza de sofás',
    'готелі та хостели': 'hotéis e hostels',
    'офіси та коворкінги': 'escritórios e espaços de coworking',
    'ресторани та кафе': 'restaurantes e cafés',
    'клініки та стоматології': 'clínicas e consultórios dentários',
    'салони краси та перукарні': 'salões de beleza e cabeleireiros',
    'дитячі центри': 'centros infantis',
    'автосалони та автосервіси': 'concessionários e oficinas',
    'спортзали та фітнес-клуби': 'ginásios e clubes de fitness',
    'школи та навчальні центри': 'escolas e centros de formação',
    'магазини меблів та інтер’єру': 'lojas de móveis e decoração',
    'торгові центри та магазини': 'centros comerciais e lojas',
    'івент-зали та розважальні заклади': 'espaços para eventos e entretenimento',
    'заводи, склади та виробництва': 'fábricas, armazéns e unidades de produção',
    'апартаменти та об’єкти розміщення': 'apartamentos e alojamentos',
    'туристичні об’єкти': 'negócios turísticos',
  },
};

function localizeTerm(value: string, lang: string) {
  const source = value.trim();
  if (!source) return source;
  return localizedTerms[lang]?.[normalizeText(source)] || source;
}

function buildMessage(
  company: Company,
  channel: Channel,
  service: string,
  targetBusiness: string,
  style: MessageStyle = 'standard',
) {
  const lang = languageCode[preferredLanguage(company)] || 'en';
  const localizedService = localizeTerm(company.localizedService || service, lang);
  const localizedTargetBusiness = localizeTerm(
    company.localizedTargetBusiness || targetBusiness,
    lang,
  );
  const short = style === 'short';
  const soft = style === 'soft';
  const trust = style === 'trust';
  const polite = style === 'polite';

  const copy = {
    uk: {
      hello: 'Добрий день',
      subject: `Можлива співпраця з ${company.name}`,
      intro: `Звернув увагу на ${company.name} і пишу, тому що ми надаємо послугу: ${localizedService}.`,
      fit: `Працюємо з бізнесами сегмента «${localizedTargetBusiness}» та підлаштовуємо виконання робіт під графік об’єкта.`,
      trust: 'Можемо почати з невеликого тестового обсягу без довгострокових зобов’язань.',
      cta: 'Чи можу надіслати коротку пропозицію, адаптовану під ваш об’єкт?',
      call: `Добрий день, мене звати [Ваше ім’я]. Телефоную щодо послуги ${localizedService}. Підкажіть, будь ласка, чи можу поговорити з людиною, відповідальною за зовнішніх підрядників?`,
      follow1: `Повертаюся до попереднього повідомлення щодо ${localizedService}.`,
      follow2: `Це моє останнє коротке нагадування щодо ${localizedService}. Якщо зараз не актуально, більше не турбуватиму.`,
      sms: `Надаємо ${localizedService} для бізнесів сегмента ${localizedTargetBusiness.toLowerCase()} у місті ${company.city}.`,
      callSteps: ['Запитайте, як зараз закривають цю потребу.', 'Уточніть, чи влаштовує поточне рішення.', 'Запропонуйте невеликий наступний крок: коротку пропозицію або тестовий обсяг.'],
    },
    pl: {
      hello: 'Dzień dobry',
      subject: `Możliwa współpraca z ${company.name}`,
      intro: `Zauważyłem ${company.name} i kontaktuję się, ponieważ oferujemy: ${localizedService}.`,
      fit: `Współpracujemy z firmami z segmentu „${localizedTargetBusiness}” i dopasowujemy zakres prac do godzin działania obiektu.`,
      trust: 'Możemy zacząć od małego zakresu próbnego, bez długoterminowego zobowiązania.',
      cta: 'Czy mogę przesłać krótką propozycję dopasowaną do Państwa obiektu?',
      call: `Dzień dobry, nazywam się [Twoje imię]. Dzwonię w sprawie ${localizedService}. Czy rozmawiam z osobą odpowiedzialną za współpracę z zewnętrznymi usługodawcami?`,
      follow1: `Wracam do mojej poprzedniej wiadomości dotyczącej ${localizedService}.`,
      follow2: `To moja ostatnia krótka wiadomość w sprawie ${localizedService}. Jeśli temat nie jest teraz aktualny, nie będę więcej przeszkadzać.`,
      sms: `Oferujemy ${localizedService} dla firm z segmentu ${localizedTargetBusiness.toLowerCase()} w ${company.city}.`,
      callSteps: ['Proszę zapytać, jak obecnie rozwiązują tę potrzebę.', 'Proszę potwierdzić, czy obecne rozwiązanie jest wystarczające.', 'Proszę zaproponować mały następny krok: krótką ofertę lub zakres testowy.'],
    },
    es: {
      hello: 'Buenos días',
      subject: `Posible colaboración con ${company.name}`,
      intro: `He visto ${company.name} y me pongo en contacto porque ofrecemos: ${localizedService}.`,
      fit: `Trabajamos con empresas del segmento «${localizedTargetBusiness}» y adaptamos el servicio al horario del negocio.`,
      trust: 'Podemos empezar con una pequeña prueba, sin compromiso a largo plazo.',
      cta: '¿Puedo enviarle una propuesta breve adaptada a su establecimiento?',
      call: `Buenos días, soy [Tu nombre]. Llamo por un servicio de ${localizedService}. ¿Podría hablar con la persona responsable de proveedores externos?`,
      follow1: `Le escribo de nuevo sobre mi mensaje anterior acerca de ${localizedService}.`,
      follow2: `Este es mi último seguimiento breve sobre ${localizedService}. Si ahora no es relevante, no volveré a molestarle.`,
      sms: `Ofrecemos ${localizedService} para ${localizedTargetBusiness.toLowerCase()} en ${company.city}.`,
      callSteps: ['Pregunte cómo resuelven actualmente esta necesidad.', 'Confirme si la solución actual es suficiente.', 'Proponga un siguiente paso pequeño: una propuesta breve o una prueba.'],
    },
    de: {
      hello: 'Guten Tag',
      subject: `Mögliche Zusammenarbeit mit ${company.name}`,
      intro: `Ich bin auf ${company.name} aufmerksam geworden und melde mich, weil wir folgende Leistung anbieten: ${localizedService}.`,
      fit: `Wir arbeiten mit Unternehmen aus dem Bereich „${localizedTargetBusiness}“ und passen die Durchführung an Ihre Betriebszeiten an.`,
      trust: 'Wir können mit einem kleinen Testumfang ohne langfristige Verpflichtung beginnen.',
      cta: 'Darf ich Ihnen einen kurzen, auf Ihren Betrieb zugeschnittenen Vorschlag senden?',
      call: `Guten Tag, mein Name ist [Ihr Name]. Ich rufe wegen ${localizedService} an. Spreche ich mit der Person, die externe Dienstleister koordiniert?`,
      follow1: `Ich melde mich noch einmal zu meiner vorherigen Nachricht über ${localizedService}.`,
      follow2: `Dies ist meine letzte kurze Nachfrage zu ${localizedService}. Falls das Thema aktuell nicht relevant ist, werde ich Sie nicht weiter stören.`,
      sms: `Wir bieten ${localizedService} für ${localizedTargetBusiness.toLowerCase()} in ${company.city} an.`,
      callSteps: ['Fragen Sie, wie dieser Bedarf derzeit gelöst wird.', 'Klären Sie, ob die aktuelle Lösung ausreichend ist.', 'Bieten Sie einen kleinen nächsten Schritt an: einen kurzen Vorschlag oder einen Testumfang.'],
    },
    fr: {
      hello: 'Bonjour',
      subject: `Collaboration possible avec ${company.name}`,
      intro: `J’ai découvert ${company.name} et je vous contacte car nous proposons : ${localizedService}.`,
      fit: `Nous travaillons avec des entreprises du segment « ${localizedTargetBusiness} » et adaptons l’intervention aux horaires de l’établissement.`,
      trust: 'Nous pouvons commencer par un petit test, sans engagement à long terme.',
      cta: 'Puis-je vous envoyer une courte proposition adaptée à votre établissement ?',
      call: `Bonjour, je m’appelle [Votre nom]. Je vous appelle au sujet de ${localizedService}. Puis-je parler à la personne responsable des prestataires externes ?`,
      follow1: `Je reviens vers vous au sujet de mon précédent message concernant ${localizedService}.`,
      follow2: `Ceci est mon dernier bref suivi concernant ${localizedService}. Si le sujet n’est pas d’actualité, je ne vous relancerai plus.`,
      sms: `Nous proposons ${localizedService} aux ${localizedTargetBusiness.toLowerCase()} à ${company.city}.`,
      callSteps: ['Demandez comment ce besoin est actuellement géré.', 'Vérifiez si la solution actuelle est satisfaisante.', 'Proposez une petite prochaine étape : une courte proposition ou un test.'],
    },
    nl: {
      hello: 'Goedendag',
      subject: `Mogelijke samenwerking met ${company.name}`,
      intro: `Ik zag ${company.name} en neem contact op omdat wij het volgende aanbieden: ${localizedService}.`,
      fit: `Wij werken met bedrijven in het segment “${localizedTargetBusiness}” en stemmen de uitvoering af op de openingstijden.`,
      trust: 'We kunnen beginnen met een kleine proef, zonder langlopende verplichting.',
      cta: 'Mag ik een kort voorstel sturen dat is afgestemd op uw locatie?',
      call: `Goedendag, u spreekt met [Uw naam]. Ik bel over ${localizedService}. Kan ik spreken met degene die externe leveranciers coördineert?`,
      follow1: `Ik kom terug op mijn vorige bericht over ${localizedService}.`,
      follow2: `Dit is mijn laatste korte opvolging over ${localizedService}. Als dit nu niet relevant is, zal ik u niet verder storen.`,
      sms: `Wij bieden ${localizedService} aan voor ${localizedTargetBusiness.toLowerCase()} in ${company.city}.`,
      callSteps: ['Vraag hoe deze behoefte nu wordt opgelost.', 'Controleer of de huidige oplossing voldoende is.', 'Stel een kleine volgende stap voor: een kort voorstel of een proefopdracht.'],
    },
    it: {
      hello: 'Buongiorno',
      subject: `Possibile collaborazione con ${company.name}`,
      intro: `Ho visto ${company.name} e vi contatto perché offriamo: ${localizedService}.`,
      fit: `Lavoriamo con aziende del segmento “${localizedTargetBusiness}” e adattiamo il servizio agli orari dell’attività.`,
      trust: 'Possiamo iniziare con una piccola prova, senza impegni a lungo termine.',
      cta: 'Posso inviarvi una breve proposta adatta alla vostra struttura?',
      call: `Buongiorno, sono [Il tuo nome]. Chiamo per un servizio di ${localizedService}. Posso parlare con chi gestisce i fornitori esterni?`,
      follow1: `La ricontatto in merito al mio precedente messaggio su ${localizedService}.`,
      follow2: `Questo è il mio ultimo breve seguito su ${localizedService}. Se non è un tema attuale, non la disturberò oltre.`,
      sms: `Offriamo ${localizedService} per ${localizedTargetBusiness.toLowerCase()} a ${company.city}.`,
      callSteps: ['Chiedi come gestiscono attualmente questa esigenza.', 'Verifica se la soluzione attuale è sufficiente.', 'Proponi un piccolo passo successivo: una breve proposta o una prova.'],
    },
    pt: {
      hello: 'Bom dia',
      subject: `Possível colaboração com ${company.name}`,
      intro: `Encontrei a ${company.name} e entro em contacto porque oferecemos: ${localizedService}.`,
      fit: `Trabalhamos com empresas do segmento “${localizedTargetBusiness}” e adaptamos o serviço ao horário do negócio.`,
      trust: 'Podemos começar com um pequeno teste, sem compromisso de longo prazo.',
      cta: 'Posso enviar uma proposta curta adaptada ao vosso espaço?',
      call: `Bom dia, o meu nome é [Seu nome]. Ligo sobre ${localizedService}. Posso falar com a pessoa responsável pelos fornecedores externos?`,
      follow1: `Volto a contactar sobre a minha mensagem anterior relativa a ${localizedService}.`,
      follow2: `Este é o meu último contacto breve sobre ${localizedService}. Se não for relevante neste momento, não voltarei a incomodar.`,
      sms: `Oferecemos ${localizedService} para ${localizedTargetBusiness.toLowerCase()} em ${company.city}.`,
      callSteps: ['Pergunte como resolvem atualmente esta necessidade.', 'Confirme se a solução atual é suficiente.', 'Proponha um pequeno próximo passo: uma proposta curta ou um teste.'],
    },
    en: {
      hello: 'Hello',
      subject: `Possible cooperation with ${company.name}`,
      intro: `I came across ${company.name} and am reaching out because we provide: ${localizedService}.`,
      fit: `We work with businesses in the “${localizedTargetBusiness}” segment and adapt the service around normal operating hours.`,
      trust: 'We can start with a small trial scope, without a long-term commitment.',
      cta: 'May I send a short proposal tailored to your location?',
      call: `Hello, my name is [Your name]. I’m calling about ${localizedService}. Could I speak with the person responsible for external service providers?`,
      follow1: `I’m following up on my previous message regarding ${localizedService}.`,
      follow2: `This is my last short follow-up regarding ${localizedService}. If this is not relevant now, I will not disturb you further.`,
      sms: `We offer ${localizedService} for ${localizedTargetBusiness.toLowerCase()} in ${company.city}.`,
      callSteps: ['Ask how they currently solve this need.', 'Confirm whether the current solution is sufficient.', 'Offer a small next step: a short proposal or test scope.'],
    },
  } as const;

  const t = copy[lang as keyof typeof copy] || copy.en;
  const intro = polite ? `${t.hello},\n\n${t.intro}` : `${t.hello},\n\n${t.intro}`;
  const body = [intro, !short ? t.fit : '', trust ? t.trust : '', soft ? t.trust : '', t.cta]
    .filter(Boolean)
    .join('\n\n');

  if (channel === 'Email') return `Subject: ${t.subject}\n\n${body}`;
  if (channel === 'Call Script')
    return `${t.call}\n\n${t.callSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`;
  if (channel === 'Follow-up 1')
    return `${t.hello}, ${t.follow1} ${t.cta}`;
  if (channel === 'Follow-up 2')
    return `${t.hello}, ${t.follow2} ${t.cta}`;
  if (channel === 'SMS')
    return `${t.hello}, ${t.sms} ${t.cta}`;
  if (channel === 'WhatsApp')
    return `${t.hello}! ${t.intro} ${short ? t.cta : `${t.trust} ${t.cta}`}`;
  return `${t.hello}! ${t.intro} ${t.fit} ${t.cta}`;
}

function shortenMessage(value: string) {
  const parts = value.split(/\n\n+/).filter(Boolean);
  return parts.length <= 3
    ? value
    : [parts[0], parts[1], parts.at(-1)].filter(Boolean).join('\n\n');
}


type ConstructorLanguage = 'uk' | 'pl' | 'en';
type ConstructorTone = 'direct' | 'friendly' | 'expert' | 'soft';
type ConstructorSource = 'ai' | 'template' | null;


type ConstructorForm = {
  service: string;
  audience: string;
  problem: string;
  result: string;
  offer: string;
  cta: string;
  proof: string;
  language: ConstructorLanguage;
  tone: ConstructorTone;
};

const emptyConstructorForm: ConstructorForm = {
  service: '',
  audience: '',
  problem: '',
  result: '',
  offer: '',
  cta: '',
  proof: '',
  language: 'uk',
  tone: 'friendly',
};

function generateOutreachPack(form: ConstructorForm) {
  const service = form.service.trim() || '[ваша послуга]';
  const audience = form.audience.trim() || '[цільова аудиторія]';
  const problem = form.problem.trim() || '[типова проблема]';
  const result = form.result.trim() || '[очікуваний результат]';
  const offer = form.offer.trim() || '[простий перший офер]';
  const cta = form.cta.trim() || '[просте запитання]';
  const proof = form.proof.trim();

  const toneLead = {
    direct: { uk: 'Пишу коротко і по суті.', pl: 'Napiszę krótko i konkretnie.', en: 'I’ll keep this short and specific.' },
    friendly: { uk: 'Побачив вашу компанію і вирішив написати особисто.', pl: 'Zobaczyłem Państwa firmę i postanowiłem napisać bezpośrednio.', en: 'I came across your company and wanted to reach out personally.' },
    expert: { uk: 'Працюючи з цим напрямком, часто бачу одну й ту саму проблему.', pl: 'Pracując z tym segmentem, często widzę ten sam problem.', en: 'Working with this segment, I often see the same recurring problem.' },
    soft: { uk: 'Можливо, це зараз не пріоритет, але залишу коротку пропозицію.', pl: 'Być może nie jest to teraz priorytet, ale zostawię krótką propozycję.', en: 'This may not be a priority right now, but I wanted to leave a short idea.' },
  }[form.tone][form.language];

  if (form.language === 'pl') {
    const subject = `${result} dla firm z segmentu ${audience}`;
    const first = `Dzień dobry,\n\n${toneLead}\n\nPomagamy firmom z segmentu ${audience} rozwiązać problem: ${problem}. Oferujemy ${service}, aby osiągnąć ${result}.${proof ? `\n\nDlaczego warto nam zaufać: ${proof}.` : ''}\n\nNa początek możemy zaproponować: ${offer}.\n\n${cta}`;
    const short = `Dzień dobry. Pomagamy firmom z segmentu ${audience} rozwiązać problem: ${problem} dzięki usłudze ${service}. Na początek: ${offer}. ${cta}`;
    return { subject, main: first, short };
  }

  if (form.language === 'en') {
    const subject = `${result} for ${audience}`;
    const first = `Hello,\n\n${toneLead}\n\nWe help ${audience} solve this problem: ${problem}. We provide ${service} to help achieve ${result}.${proof ? `\n\nWhy clients trust us: ${proof}.` : ''}\n\nA simple first step could be: ${offer}.\n\n${cta}`;
    const short = `Hello. We help ${audience} solve ${problem} through ${service}. A simple first step: ${offer}. ${cta}`;
    return { subject, main: first, short };
  }

  const subject = `${result} для ${audience}`;
  const first = `Добрий день!\n\n${toneLead}\n\nМи допомагаємо бізнесам у сегменті «${audience}» вирішити проблему: ${problem}. Надаємо ${service}, щоб отримати ${result}.${proof ? `\n\nЧому нам можна довіряти: ${proof}.` : ''}\n\nДля початку можемо запропонувати: ${offer}.\n\n${cta}`;
  const short = `Добрий день! Допомагаємо ${audience} вирішити проблему «${problem}» за допомогою ${service}. Для початку: ${offer}. ${cta}`;
  return { subject, main: first, short };
}

export default function App({ userId, profile, onSignOut }: { userId: string; profile: Profile; onSignOut: () => void }) {
  const searchStateKey = `norov-local-ai-search-state:${userId}`;
  const savedSearchState = (() => {
    try {
      return JSON.parse(localStorage.getItem(searchStateKey) || 'null') as {
        filters?: SearchFilters;
        hasSearched?: boolean;
        selectedId?: string | null;
        lastSearchIds?: string[] | null;
        searchSource?: 'google' | 'geoapify' | 'combined' | 'demo';
        usage?: { searches: number; limit: number } | null;
      } | null;
    } catch {
      return null;
    }
  })();

  const [filters, setFilters] = useState<SearchFilters>(savedSearchState?.filters ?? {
    service: '',
    targetBusiness: '',
    country: '',
    city: '',
    radius: 25,
  });
  const [companies, setCompanies] = useState<Company[]>(() => {
    const saved = localStorage.getItem('norov-local-ai-companies');
    if (!saved) return initialCompanies;
    try {
      return mergeSavedCompanies(JSON.parse(saved));
    } catch {
      return initialCompanies;
    }
  });
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(Boolean(savedSearchState?.hasSearched));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel>('Email');
  const viewStateKey = `norov-local-ai-active-view:${userId}`;
  const [view, setView] = useState<'search' | 'crm' | 'constructor' | 'guide' | 'admin'>(() => {
    const savedView = localStorage.getItem(viewStateKey);
    return savedView === 'search' || savedView === 'crm' || savedView === 'constructor' || savedView === 'guide' || savedView === 'admin'
      ? savedView
      : 'search';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchSource, setSearchSource] = useState<'google' | 'geoapify' | 'combined' | 'demo'>(savedSearchState?.searchSource ?? 'geoapify');
  const [usage, setUsage] = useState<{ searches: number; limit: number } | null>(savedSearchState?.usage ?? null);
  const [cloudReady, setCloudReady] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [lastSearchIds, setLastSearchIds] = useState<string[] | null>(savedSearchState?.lastSearchIds ?? null);
  const [crmFilter, setCrmFilter] = useState('');
  const [crmSelectedId, setCrmSelectedId] = useState<string | null>(null);
  const [activityText, setActivityText] = useState('');
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('norov-local-ai-message-drafts') || '{}');
    } catch {
      return {};
    }
  });
  const [messageStyle, setMessageStyle] = useState<MessageStyle>('standard');
  const [crmIds, setCrmIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('norov-local-ai-crm-ids') || '[]');
    } catch {
      return [];
    }
  });

  const [constructorForm, setConstructorForm] = useState<ConstructorForm>(() => {
    try {
      return { ...emptyConstructorForm, ...JSON.parse(localStorage.getItem('norov-local-ai-constructor') || '{}') };
    } catch {
      return emptyConstructorForm;
    }
  });
  const savedConstructorResult = (() => {
    try {
      return JSON.parse(localStorage.getItem('norov-local-ai-constructor-result') || 'null') as {
        pack?: OutreachPack;
        generated?: boolean;
        source?: ConstructorSource;
      } | null;
    } catch {
      return null;
    }
  })();
  const [constructorGenerated, setConstructorGenerated] = useState(Boolean(savedConstructorResult?.generated));
  const [aiPack, setAiPack] = useState<OutreachPack | null>(savedConstructorResult?.pack ?? null);
  const [constructorSource, setConstructorSource] = useState<ConstructorSource>(savedConstructorResult?.source ?? null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const templateOutreachPack = useMemo(() => generateOutreachPack(constructorForm), [constructorForm]);
  const outreachPack = aiPack ?? templateOutreachPack;

  const detailPanelRef = useRef<HTMLElement | null>(null);
  const leadListRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCloudState() {
      const { data } = await supabase.from('user_state').select('state').eq('user_id', userId).maybeSingle();
      if (cancelled) return;
      const state = data?.state as { companies?: Company[]; crmIds?: string[]; messageDrafts?: Record<string, string>; search?: { filters?: SearchFilters; hasSearched?: boolean; selectedId?: string | null; lastSearchIds?: string[] | null; searchSource?: 'google' | 'geoapify' | 'combined' | 'demo'; usage?: { searches: number; limit: number } | null } } | undefined;
      if (state?.companies) setCompanies(mergeSavedCompanies(state.companies));
      if (state?.crmIds) setCrmIds(state.crmIds);
      if (state?.messageDrafts) setMessageDrafts(state.messageDrafts);
      if (state?.search) {
        if (state.search.filters) setFilters(state.search.filters);
        if (typeof state.search.hasSearched === 'boolean') setHasSearched(state.search.hasSearched);
        if ('lastSearchIds' in state.search) setLastSearchIds(state.search.lastSearchIds ?? null);
        if (state.search.searchSource) setSearchSource(state.search.searchSource);
        if ('usage' in state.search) setUsage(state.search.usage ?? null);
      }
      setCloudReady(true);
    }
    loadCloudState();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    localStorage.setItem('norov-local-ai-companies', JSON.stringify(companies));
    localStorage.setItem('norov-local-ai-crm-ids', JSON.stringify(crmIds));
    localStorage.setItem('norov-local-ai-message-drafts', JSON.stringify(messageDrafts));
    const search = { filters, hasSearched, lastSearchIds, searchSource, usage };
    localStorage.setItem(searchStateKey, JSON.stringify(search));
    if (!cloudReady) return;
    const timer = window.setTimeout(() => {
      supabase.from('user_state').upsert({ user_id: userId, state: { companies, crmIds, messageDrafts, search }, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [companies, crmIds, messageDrafts, filters, hasSearched, lastSearchIds, searchSource, usage, cloudReady, userId, searchStateKey]);

  useEffect(() => {
    localStorage.setItem(viewStateKey, view);
  }, [view, viewStateKey]);

  useEffect(() => {
    localStorage.setItem('norov-local-ai-constructor', JSON.stringify(constructorForm));
  }, [constructorForm]);

  useEffect(() => {
    if (!constructorGenerated) {
      localStorage.removeItem('norov-local-ai-constructor-result');
      return;
    }
    localStorage.setItem('norov-local-ai-constructor-result', JSON.stringify({
      pack: outreachPack,
      generated: true,
      source: constructorSource,
    }));
  }, [constructorGenerated, outreachPack, constructorSource]);

  const selected = companies.find((company) => company.id === selectedId) ?? null;

  const visibleCompanies = useMemo(() => {
    if (!hasSearched) return [];
    if (lastSearchIds !== null) {
      const idSet = new Set(lastSearchIds);
      return companies.filter((company) => idSet.has(company.id));
    }
    return companies.filter(
      (company) => company.country === filters.country && cityMatches(company.city, filters.city),
    );
  }, [companies, filters.country, filters.city, hasSearched, lastSearchIds]);

  async function createAiOutreach() {
    const required = [constructorForm.service, constructorForm.audience, constructorForm.problem, constructorForm.result, constructorForm.offer, constructorForm.cta];
    if (required.some((value) => !value.trim())) { setAiError('Заповніть усі обов’язкові поля.'); return; }
    setAiGenerating(true); setAiError('');
    try { const response = await generateAiOutreach(constructorForm); setAiPack(response.pack); setConstructorSource('ai'); setConstructorGenerated(true); window.requestAnimationFrame(() => document.querySelector('.constructor-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }
    catch (error) { setAiError(error instanceof Error ? error.message : 'Не вдалося створити AI-звернення.'); }
    finally { setAiGenerating(false); }
  }
  function createTemplateOutreach() { setAiPack(null); setConstructorSource('template'); setAiError(''); setConstructorGenerated(true); }

  function selectCompany(id: string) {
    setSelectedId(id);
    if (window.matchMedia('(max-width: 1100px)').matches) {
      window.requestAnimationFrame(() => {
        detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  function resetSearch() {
    setFilters({ service: '', targetBusiness: '', country: '', city: '', radius: 25 });
    setHasSearched(false);
    setSelectedId(null);
    setLastSearchIds(null);
    setSearchError('');
    setUsage(null);
    localStorage.removeItem(searchStateKey);
  }

  async function runSearch() {
    if (!filters.service.trim() || !filters.targetBusiness || !filters.country || !filters.city.trim()) {
      setSearchError('Заповніть послугу, цільовий сегмент, країну та місто.');
      return;
    }
    setIsSearching(true);
    setHasSearched(false);
    setSelectedId(null);
    setSearchError('');
    setLastSearchIds([]);

    try {
      const result = await searchCompanies(filters);
      setSearchSource(result.source);
      setUsage(result.usage || null);
      setLastSearchIds(result.companies.map((company) => company.id));
      if (result.companies.length > 0) {
        setCompanies((current) => mergeSavedCompanies([...current, ...result.companies]));
      }
      setSelectedId(null);
    } catch (error) {
      setSearchSource('geoapify');
      setSearchError(error instanceof Error ? error.message : 'Помилка пошуку');
      setLastSearchIds([]);
      setSelectedId(null);
    } finally {
      setHasSearched(true);
      setIsSearching(false);
    }
  }

  function updateCompany(id: string, patch: Partial<Company>) {
    setCompanies((current) =>
      current.map((company) => (company.id === id ? { ...company, ...patch } : company)),
    );
  }

  function addActivity(id: string, type: LeadActivity['type'], text: string) {
    if (!text.trim()) return;
    setCompanies((current) =>
      current.map((company) =>
        company.id === id
          ? {
              ...company,
              activities: [
                {
                  id: crypto.randomUUID(),
                  type,
                  text: text.trim(),
                  createdAt: new Date().toISOString(),
                },
                ...(company.activities || []),
              ],
            }
          : company,
      ),
    );
  }

  function changeStatus(id: string, status: LeadStatus) {
    const company = companies.find((item) => item.id === id);
    updateCompany(id, { status });
    if (company && company.status !== status)
      addActivity(id, 'status', `Статус змінено: ${company.status} → ${status}`);
  }

  function moveLead(id: string, status: LeadStatus) {
    changeStatus(id, status);
  }

  function toggleCrm(id: string) {
    setCrmIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  const crmCompanies = companies.filter((company) => crmIds.includes(company.id));
  const filteredCrmCompanies = crmCompanies.filter((company) => {
    const q = normalizeText(crmFilter);
    return (
      !q ||
      normalizeText(
        `${company.name} ${company.city} ${company.country} ${company.email} ${company.phone}`,
      ).includes(q)
    );
  });
  const crmSelected = companies.find((company) => company.id === crmSelectedId) ?? null;
  const draftKey = selected ? `${selected.id}|${channel}` : '';
  const generatedMessage = selected
    ? buildMessage(selected, channel, filters.service, filters.targetBusiness, messageStyle)
    : '';
  const currentMessage = selected ? (messageDrafts[draftKey] ?? generatedMessage) : '';

  function setCurrentMessage(value: string) {
    if (!draftKey) return;
    setMessageDrafts((current) => ({ ...current, [draftKey]: value }));
  }

  function regenerate(style: MessageStyle = messageStyle) {
    if (!selected || !draftKey) return;
    setMessageStyle(style);
    setMessageDrafts((current) => ({
      ...current,
      [draftKey]: buildMessage(selected, channel, filters.service, filters.targetBusiness, style),
    }));
  }

  function startWork(company: Company) {
    if (!crmIds.includes(company.id)) setCrmIds((current) => [...current, company.id]);
    addActivity(company.id, 'status', 'Ліда додано в CRM і розпочато роботу');
  }

  function saveOutreachToHistory() {
    if (!selected || !currentMessage.trim()) return;
    if (!crmIds.includes(selected.id)) setCrmIds((current) => [...current, selected.id]);
    addActivity(selected.id, 'contact', `${channel}: ${currentMessage.trim()}`);
  }

  return (
    <div className={`app-shell ${mobileMenuOpen ? 'menu-open' : ''}`}>
      <button className="mobile-backdrop" aria-label="Закрити меню" onClick={() => setMobileMenuOpen(false)} />
      <aside className="sidebar">
        <button className="sidebar-close" aria-label="Закрити меню" onClick={() => setMobileMenuOpen(false)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="brand">
          <div className="brand-mark">N</div>
          <div>
            <strong>Norov Local AI</strong>
            <span>AI Sales OS</span>
          </div>
        </div>
        <nav>
          <button
            className={view === 'search' ? 'active' : ''}
            onClick={() => { setView('search'); setMobileMenuOpen(false); }}>
            Пошук лідів
          </button>
          <button
            className={view === 'crm' ? 'active' : ''}
            onClick={() => { setView('crm'); setMobileMenuOpen(false); }}>
            CRM
          </button>
          <button
            className={view === 'constructor' ? 'active' : ''}
            onClick={() => { setView('constructor'); setMobileMenuOpen(false); }}>
            Конструктор звернення
          </button>
          <button
            className={view === 'guide' ? 'active' : ''}
            onClick={() => { setView('guide'); setMobileMenuOpen(false); }}>
            Гайд із розсилок
          </button>
          {profile.role === 'admin' && (
            <button className={view === 'admin' ? 'active' : ''} onClick={() => { setView('admin'); setMobileMenuOpen(false); }}>
              Адмінка
            </button>
          )}
        </nav>
        <div className="sidebar-account">
          <div><strong>{profile.full_name || 'Користувач'}</strong><small>{profile.email}</small></div>
          <button onClick={onSignOut}>Вийти</button>
        </div>
        <a className="telegram-support" href="https://t.me/s_norov" target="_blank" rel="noopener noreferrer">
          <strong>Потрібна допомога?</strong>
          <span>Напишіть Сергію в Telegram</span>
        </a>
        <div className="sidebar-note">
          <span>{profile.role === 'admin' ? 'Адміністратор' : 'Активний доступ'}</span>
          Дані синхронізуються через Supabase.
          {usage && <small>Пошуки: {usage.searches}{usage.limit > 0 ? ` / ${usage.limit}` : ''}</small>}
        </div>
      </aside>

      <main>
        <div className="mobile-header">
          <button className="menu-toggle" aria-label="Відкрити меню" onClick={() => setMobileMenuOpen(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <div className="mobile-brand"><span className="brand-mark">N</span><strong>Norov Local AI</strong></div>
        </div>
        <header className="topbar">
          <div>
            <p className="eyebrow">Локальні B2B-продажі</p>
            <h1>
              {view === 'search'
                ? 'Знайдіть потенційних B2B-клієнтів'
                : view === 'crm'
                  ? 'CRM та історія роботи з лідами'
                  : view === 'constructor'
                    ? 'Конструктор сильного B2B-звернення'
                    : view === 'guide'
                      ? 'Гайд із безпечних B2B-розсилок'
                      : 'Керування Norov Local AI'}
            </h1>
          </div>
        </header>

        {view === 'admin' ? (
          <AdminPanel />
        ) : view === 'guide' ? (
          <section className="guide-page">
            <div className="guide-hero">
              <div>
                <p className="eyebrow">Практична система outreach</p>
                <h2>Як писати компаніям, отримувати відповіді та не виглядати як спам</h2>
                <p>
                  Цей гайд допоможе підготувати пошту, обрати релевантні компанії,
                  створити сильне перше повідомлення та правильно робити follow-up.
                </p>
              </div>
              <div className="guide-hero-actions">
                <button className="primary" onClick={() => setView('constructor')}>Створити звернення</button>
                <a className="telegram-inline" href="https://t.me/s_norov" target="_blank" rel="noopener noreferrer">
                  Поставити питання в Telegram ↗
                </a>
              </div>
            </div>

            <div className="guide-checklist">
              <strong>Швидкий старт</strong>
              <ol>
                <li>Знайдіть 10–20 справді релевантних компаній.</li>
                <li>Перегляньте сайт або профіль кожної компанії.</li>
                <li>Додайте одну конкретну деталь у перше речення.</li>
                <li>Запропонуйте простий наступний крок без тиску.</li>
                <li>Збережіть компанію в CRM і заплануйте follow-up.</li>
              </ol>
            </div>

            <div className="guide-grid">
              <article className="guide-card">
                <span>01</span>
                <h3>Підготуйте робочу пошту</h3>
                <p>Для системної розсилки краще використовувати адресу на власному домені, а не випадкову особисту пошту.</p>
                <ul>
                  <li>Налаштуйте SPF, DKIM і DMARC.</li>
                  <li>Додайте реальне ім’я, компанію та підпис.</li>
                  <li>Не починайте одразу із сотень однакових листів.</li>
                  <li>Перевіряйте помилки доставки й не пишіть повторно на неіснуючі адреси.</li>
                </ul>
              </article>

              <article className="guide-card">
                <span>02</span>
                <h3>Якість бази важливіша за кількість</h3>
                <p>Не надсилайте один текст усім компаніям підряд. Відбирайте бізнеси, яким ваша послуга реально може бути корисною.</p>
                <ul>
                  <li>Перевірте місто, сферу та розмір компанії.</li>
                  <li>Знайдіть ознаку потреби: нова філія, активний найм, великий об’єкт, застарілий сайт.</li>
                  <li>Не пишіть компаніям, які явно не відповідають вашій пропозиції.</li>
                </ul>
              </article>

              <article className="guide-card">
                <span>03</span>
                <h3>Тема листа має бути простою</h3>
                <p>Тема не повинна виглядати як реклама або обман. Її задача — чесно пояснити причину звернення.</p>
                <div className="guide-examples">
                  <strong>Краще:</strong>
                  <code>Питання щодо прибирання номерів у [назва готелю]</code>
                  <code>Ідея для [назва компанії]</code>
                  <code>Хто відповідає за [напрямок]?</code>
                  <strong>Гірше:</strong>
                  <code>ТЕРМІНОВО! Унікальна пропозиція</code>
                  <code>Ви втратили клієнтів</code>
                </div>
              </article>

              <article className="guide-card">
                <span>04</span>
                <h3>Формула першого повідомлення</h3>
                <ol>
                  <li><b>Спостереження:</b> чому ви пишете саме цій компанії.</li>
                  <li><b>Проблема:</b> одна знайома бізнесу ситуація.</li>
                  <li><b>Результат:</b> що конкретно ви допомагаєте покращити.</li>
                  <li><b>Офер:</b> простий перший крок без великого ризику.</li>
                  <li><b>Запитання:</b> відповідь має бути легкою.</li>
                </ol>
                <blockquote>
                  Добрий день. Побачив, що у вас кілька об’єктів у Вроцлаві. Ми допомагаємо готелям
                  оновити вигляд м’яких меблів без дорогої заміни. Можемо безкоштовно оцінити
                  2–3 типові об’єкти. Хто у вас відповідає за цей напрямок?
                </blockquote>
              </article>

              <article className="guide-card">
                <span>05</span>
                <h3>Персоналізація без AI</h3>
                <p>Одного речення достатньо, щоб лист не виглядав масовим.</p>
                <ul>
                  <li>Згадайте конкретну послугу або сторінку сайту.</li>
                  <li>Посилайтеся лише на правдиву публічну інформацію.</li>
                  <li>Не використовуйте фальшиві компліменти.</li>
                  <li>Не вставляйте назву компанії в кожне речення.</li>
                </ul>
              </article>

              <article className="guide-card">
                <span>06</span>
                <h3>Follow-up без нав’язливості</h3>
                <p>Більшість людей не відповідає на перший лист не через відмову, а через зайнятість.</p>
                <ul>
                  <li>Follow-up №1: через 3–5 робочих днів.</li>
                  <li>Follow-up №2: ще через 5–7 днів.</li>
                  <li>Не дублюйте повністю перший лист.</li>
                  <li>Після другого follow-up зупиніться або поверніться через кілька місяців із новим приводом.</li>
                </ul>
              </article>

              <article className="guide-card">
                <span>07</span>
                <h3>Що підвищує ризик спаму</h3>
                <ul>
                  <li>Велика кількість однакових листів за короткий час.</li>
                  <li>Оманлива тема, багато великих літер або знаків оклику.</li>
                  <li>Кілька посилань, важкі вкладення та картинки в першому листі.</li>
                  <li>Куплені бази з неактуальними адресами.</li>
                  <li>Ігнорування відмов і негативних відповідей.</li>
                </ul>
              </article>

              <article className="guide-card">
                <span>08</span>
                <h3>Працюйте через CRM</h3>
                <p>Після кожної дії змінюйте статус і залишайте коротку нотатку.</p>
                <ul>
                  <li><b>New:</b> компанію ще не контактували.</li>
                  <li><b>Contacted:</b> перше звернення надіслано.</li>
                  <li><b>Replied:</b> отримано відповідь.</li>
                  <li><b>Interested / Quote Sent:</b> є предметний інтерес.</li>
                  <li><b>Won / Lost:</b> зафіксуйте фінальний результат.</li>
                </ul>
              </article>
            </div>

            <section className="guide-final">
              <div>
                <p className="eyebrow">Перед відправленням</p>
                <h3>Фінальний чекліст</h3>
              </div>
              <div className="guide-final-list">
                <label><input type="checkbox" /> Компанія відповідає моїй цільовій аудиторії</label>
                <label><input type="checkbox" /> Я пояснив, чому пишу саме їй</label>
                <label><input type="checkbox" /> У листі немає неправдивих обіцянок</label>
                <label><input type="checkbox" /> Є один зрозумілий офер і одне запитання</label>
                <label><input type="checkbox" /> Текст короткий і читається з телефона</label>
                <label><input type="checkbox" /> Компанія додана в CRM</label>
              </div>
              <div className="guide-final-actions">
                <button className="primary" onClick={() => setView('constructor')}>Перейти до конструктора</button>
                <a className="telegram-inline" href="https://t.me/s_norov" target="_blank" rel="noopener noreferrer">
                  Написати Сергію
                </a>
              </div>
            </section>
          </section>
        ) : view === 'constructor' ? (
          <section className="constructor-page">
            <div className="constructor-intro">
              <div>
                <p className="eyebrow">AI Outreach Constructor</p>
                <h2>Заповніть короткий бриф — AI створить основне та коротке повідомлення</h2>
                <p>Заповнюйте простими словами — не потрібно самостійно писати рекламний текст. AI оформить вашу пропозицію для Email, Facebook, Instagram, WhatsApp, Telegram і короткого direct.</p>
              </div>
              <a className="telegram-inline" href="https://t.me/s_norov" target="_blank" rel="noopener noreferrer">Написати Сергію в Telegram ↗</a>
            </div>

            <div className="constructor-layout">
              <section className="constructor-form-card">
                <div className="constructor-grid">
                  <label>Що ви продаєте?
                    <input value={constructorForm.service} onChange={(e) => setConstructorForm({ ...constructorForm, service: e.target.value })} placeholder="Наприклад, хімчистка меблів" />
                    <small className="constructor-help">Назвіть одну конкретну послугу або продукт.</small>
                  </label>
                  <label>Кому продаєте?
                    <input value={constructorForm.audience} onChange={(e) => setConstructorForm({ ...constructorForm, audience: e.target.value })} placeholder="Наприклад, готелям у Вроцлаві" />
                    <small className="constructor-help">Вкажіть тип бізнесу та, за потреби, місто або регіон.</small>
                  </label>
                  <label className="wide">Яку проблему клієнт хоче вирішити?
                    <textarea value={constructorForm.problem} onChange={(e) => setConstructorForm({ ...constructorForm, problem: e.target.value })} placeholder="Наприклад, меблі швидко втрачають вигляд, а заміна коштує дорого" />
                    <small className="constructor-help">Опишіть одну реальну проблему або те, чого клієнт хоче уникнути.</small>
                  </label>
                  <label>Що отримає клієнт після вашої послуги?
                    <input value={constructorForm.result} onChange={(e) => setConstructorForm({ ...constructorForm, result: e.target.value })} placeholder="Наприклад, чисті меблі без зупинки роботи готелю" />
                    <small className="constructor-help">Сформулюйте зрозумілий результат без перебільшень.</small>
                  </label>
                  <label>Що запропонувати для першого контакту?
                    <input value={constructorForm.offer} onChange={(e) => setConstructorForm({ ...constructorForm, offer: e.target.value })} placeholder="Наприклад, безкоштовна оцінка або знижка на перше замовлення" />
                    <small className="constructor-help">Оберіть простий крок, на який клієнту легко погодитися.</small>
                  </label>
                  <label className="wide">Чому вам можна довіряти? <span className="optional">необов’язково</span>
                    <input value={constructorForm.proof} onChange={(e) => setConstructorForm({ ...constructorForm, proof: e.target.value })} placeholder="Наприклад, 5 років досвіду, 200+ виконаних замовлень" />
                    <small className="constructor-help">Досвід, кількість клієнтів, гарантія, сертифікат або інший правдивий факт.</small>
                  </label>
                  <label className="wide">Яку відповідь ви хочете отримати?
                    <input value={constructorForm.cta} onChange={(e) => setConstructorForm({ ...constructorForm, cta: e.target.value })} placeholder="Наприклад, хто у вас відповідає за обслуговування меблів?" />
                    <small className="constructor-help">Поставте одне просте запитання, на яке легко відповісти.</small>
                  </label>
                  <label>Мова
                    <select value={constructorForm.language} onChange={(e) => setConstructorForm({ ...constructorForm, language: e.target.value as ConstructorLanguage })}>
                      <option value="uk">Українська</option><option value="pl">Polski</option><option value="en">English</option>
                    </select>
                  </label>
                  <label>Стиль
                    <select value={constructorForm.tone} onChange={(e) => setConstructorForm({ ...constructorForm, tone: e.target.value as ConstructorTone })}>
                      <option value="friendly">Людяний</option><option value="direct">Прямий</option><option value="expert">Експертний</option><option value="soft">М’який</option>
                    </select>
                  </label>
                </div>
                {aiError && <div className="ai-error">{aiError}</div>}
                <div className="constructor-form-actions ai-actions">
                  <button
                    className="constructor-clear"
                    onClick={() => {
                      if (!window.confirm('Очистити бриф і згенеровані тексти?')) return;
                      setConstructorForm(emptyConstructorForm);
                      setConstructorGenerated(false);
                      setAiPack(null);
                      setConstructorSource(null);
                      setAiError('');
                      localStorage.removeItem('norov-local-ai-constructor-result');
                    }}>
                    Очистити
                  </button>
                  <button className="constructor-template" onClick={createTemplateOutreach} disabled={aiGenerating}>Створити без AI</button>
                  <button className="constructor-ai" onClick={createAiOutreach} disabled={aiGenerating}>
                    {aiGenerating ? 'AI генерує…' : '✦ Згенерувати через AI'}
                  </button>
                </div>
              </section>

              <section className={`constructor-results ${constructorGenerated ? 'ready' : ''}`}>
                {!constructorGenerated ? (
                  <div className="constructor-placeholder"><span>✦</span><strong>Заповніть бриф і натисніть «Згенерувати через AI»</strong><p>Тут з’являться тема для email, основне повідомлення та коротка версія.</p></div>
                ) : (
                  <>
                    <div className={`constructor-source ${constructorSource === 'ai' ? 'ai' : 'template'}`}>
                      {constructorSource === 'ai' ? '✦ Згенеровано за допомогою AI' : 'Шаблонний режим без AI'}
                    </div>
                    {[
                      ['Тема для email', outreachPack.subject],
                      ['Основне повідомлення · Email / Facebook / Instagram / WhatsApp / Telegram', outreachPack.main],
                      ['Коротке повідомлення · SMS / короткий direct', outreachPack.short],
                    ].map(([title, text]) => (
                      <article className="constructor-output" key={title}>
                        <div><strong>{title}</strong><button onClick={() => navigator.clipboard.writeText(text)}>Скопіювати</button></div>
                        <textarea readOnly value={text} />
                      </article>
                    ))}
                    <a className="telegram-result" href="https://t.me/s_norov" target="_blank" rel="noopener noreferrer">Потрібна допомога з текстом? Напишіть мені в Telegram ↗</a>
                  </>
                )}
              </section>
            </div>
          </section>
        ) : view === 'search' ? (
          <>
            <section className="search-panel">
              <label className="service-field">
                Що ви продаєте?
                <input
                  placeholder="Наприклад, хімчистка меблів"
                  value={filters.service}
                  onChange={(e) => setFilters({ ...filters, service: e.target.value })}
                />
                <small className="field-help">
                  Пишіть будь-якою зручною мовою — це використовується для персоналізації звернення.
                </small>
              </label>
              <label>
                Кому продаємо
                <select
                  value={filters.targetBusiness}
                  onChange={(e) => setFilters({ ...filters, targetBusiness: e.target.value })}>
                  <option value="" disabled>Оберіть сегмент</option>
                  {targetSegments.map((segment) => (
                    <option key={segment}>{segment}</option>
                  ))}
                </select>
              </label>
              <label>
                Країна
                <select
                  value={filters.country}
                  onChange={(e) => setFilters({ ...filters, country: e.target.value, city: '' })}>
                  <option value="" disabled>Оберіть країну</option>
                  {countries.map((country) => (
                    <option key={country}>{country}</option>
                  ))}
                </select>
              </label>
              <label>
                Місто
                <input
                  placeholder="Наприклад, Brugge"
                  value={filters.city}
                  onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                />
              </label>
              <label>
                Радіус
                <select
                  value={filters.radius}
                  onChange={(e) => setFilters({ ...filters, radius: Number(e.target.value) })}>
                  <option value={10}>10 км</option>
                  <option value={25}>25 км</option>
                  <option value={50}>50 км</option>
                  <option value={100}>100 км</option>
                </select>
              </label>
              <button
                className="primary"
                onClick={runSearch}
                disabled={isSearching}>
                {isSearching ? 'Аналізуємо…' : 'Знайти компанії'}
              </button>
            </section>

            {isSearching && (
              <section className="search-progress">
                <div className="spinner" />
                <div>
                  <strong>Шукаємо потенційних клієнтів</strong>
                  <span>
                    Шукаємо вибраний тип бізнесу, перевіряємо контакти та визначаємо мову.
                  </span>
                </div>
              </section>
            )}

            {!isSearching && searchError && <div className="api-warning">{searchError}</div>}

            {!isSearching && !hasSearched && (
              <section className="welcome-state">
                <div className="welcome-icon">↗</div>
                <h2>Почніть з пошуку потенційних клієнтів</h2>
                <p>
                  Вкажіть, що ви продаєте, кому продаєте, країну та місто. Результати з’являться
                  лише після натискання кнопки «Знайти компанії».
                </p>
              </section>
            )}

            {!isSearching && hasSearched && (
              <>
                <section className="metrics">
                  <div>
                    <span>Знайдено</span>
                    <strong>{visibleCompanies.length}</strong>
                    <small>
                      {searchSource === 'google' ? 'Google Places' : searchSource === 'combined' ? 'Google + Geoapify' : searchSource === 'geoapify' ? 'Geoapify / OpenStreetMap' : 'демо-дані'}
                    </small>
                  </div>
                  <div>
                    <span>Цільовий сегмент</span>
                    <strong>{filters.targetBusiness}</strong>
                    <small>компанії, яким продаємо послугу</small>
                  </div>
                  <div>
                    <span>З контактами</span>
                    <strong>
                      {visibleCompanies.filter((c) => c.website || c.phone || c.email).length}
                    </strong>
                    <small>сайт, телефон або email</small>
                  </div>
                  <div>
                    <span>Мова ринку</span>
                    <strong>{countryLanguage[filters.country] || 'English'}</strong>
                    <small>уточнюється по сайту</small>
                  </div>
                </section>

                <div className="workspace">
                  <section className="lead-list" ref={leadListRef}>
                    <div className="section-title">
                      <div>
                        <p className="eyebrow">Потенційні клієнти</p>
                        <h2>Компанії у вибраному сегменті</h2>
                      </div>
                      <div className="section-title-actions">
                        <span>{visibleCompanies.length} результатів</span>
                        <button className="secondary compact" onClick={resetSearch}>Новий пошук</button>
                      </div>
                    </div>
                    {visibleCompanies.length === 0 ? (
                      <div className="empty-state">
                        <strong>Нічого не знайдено</strong>
                        <span>
                          Перевірте місто або спробуйте ширший запит. Спробуйте загальніший запит
                          або збільште радіус. OpenStreetMap може мати неповні дані для вузьких ніш.
                        </span>
                      </div>
                    ) : (
                      visibleCompanies.map((company) => (
                        <button
                          key={company.id}
                          className={`lead-card ${selectedId === company.id ? 'selected' : ''}`}
                          onClick={() => selectCompany(company.id)}>
                          <div className="lead-main">
                            <div>
                              <strong>{company.name}</strong>
                              <span>
                                {company.category} · {company.city}
                              </span>
                            </div>
                            <p>{company.reason}</p>
                            <div className="tags">
                              <span>{company.language}</span>
                              {company.rating > 0 && (
                                <span>
                                  ★ {company.rating} ({company.reviews})
                                </span>
                              )}
                              <span>
                                {company.website || company.phone || company.email
                                  ? 'Є контакти'
                                  : 'Контакти не знайдено'}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`status status-${company.status.toLowerCase().replaceAll(' ', '-')}`}>
                            {company.status}
                          </span>
                        </button>
                      ))
                    )}
                  </section>

                  <aside ref={detailPanelRef} className={`detail-panel ${selected ? 'has-selection' : ''}`}>
                    {!selected ? (
                      <div className="empty-state">
                        <strong>Оберіть компанію</strong>
                        <span>Праворуч з’являться контакти, потреби та скрипт звернення.</span>
                      </div>
                    ) : (
                      <>
                        <button
                          className="mobile-detail-back"
                          onClick={() => {
                            setSelectedId(null);
                            window.requestAnimationFrame(() => leadListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                          }}>
                          ← До результатів
                        </button>
                        <div className="detail-head">
                          <div>
                            <p className="eyebrow">Потенційний B2B-клієнт</p>
                            <h2>{selected.name}</h2>
                            {selected.website && (
                              <a
                                href={selected.website}
                                target="_blank">
                                Відкрити сайт ↗
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="contact-grid">
                          <span>{selected.email}</span>
                          <span>{selected.phone}</span>
                          <span>{selected.address}</span>
                        </div>
                        <div className="insight">
                          <strong>Чому варто контактувати</strong>
                          <p>{selected.reason}</p>
                        </div>
                        <div className="insight">
                          <strong>Ймовірні потреби</strong>
                          <ul>
                            {selected.painPoints.map((point) => (
                              <li key={point}>{point}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="insight accent">
                          <strong>Рекомендований офер</strong>
                          <p>{selected.offer}</p>
                        </div>

                        <button
                          className={crmIds.includes(selected.id) ? 'secondary' : 'primary'}
                          onClick={() => startWork(selected)}>
                          {crmIds.includes(selected.id) ? 'Лід уже в CRM' : '+ Почати роботу'}
                        </button>

                        <div className="field-row single">
                          <label>
                            CRM статус
                            <select
                              value={selected.status}
                              onChange={(e) =>
                                changeStatus(selected.id, e.target.value as LeadStatus)
                              }>
                              {statuses.map((status) => (
                                <option key={status}>{status}</option>
                              ))}
                            </select>
                          </label>
                          <div className="detected-language">
                            <span>Мова звернення</span>
                            <strong>
                              {selected.language || countryLanguage[selected.country] || 'English'}
                            </strong>
                            <small>Визначається автоматично за країною та даними компанії</small>
                          </div>
                        </div>

                        <div className="message-box sales-engine">
                          <div className="sales-engine-head">
                            <div>
                              <div className="sales-engine-title">
                                <strong>Sales Engine</strong>
                                <span className="template-badge">Шаблонний текст</span>
                              </div>
                              <small>Створюється локально без витрат API — чернетку можна вільно редагувати</small>
                            </div>
                            <button
                              className="secondary compact"
                              onClick={() => regenerate('standard')}>
                              Згенерувати заново
                            </button>
                          </div>
                          <div className="channel-tabs">
                            {channels.map((item) => (
                              <button
                                key={item}
                                className={channel === item ? 'active' : ''}
                                onClick={() => setChannel(item)}>
                                {item}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={currentMessage}
                            onChange={(e) => setCurrentMessage(e.target.value)}
                            placeholder="Текст звернення буде згенеровано автоматично, але ви можете змінити будь-яку частину."
                          />
                          <div className="rewrite-actions">
                            <button
                              onClick={() => {
                                setCurrentMessage(shortenMessage(currentMessage));
                                setMessageStyle('short');
                              }}>
                              Коротше
                            </button>
                            <button onClick={() => regenerate('polite')}>Ввічливіше</button>
                            <button onClick={() => regenerate('trust')}>Більше довіри</button>
                            <button onClick={() => regenerate('soft')}>Менш продажно</button>
                          </div>
                          <div className="message-actions">
                            <button
                              className="secondary"
                              onClick={() => navigator.clipboard.writeText(currentMessage)}>
                              Скопіювати текст
                            </button>
                            <button
                              className="primary small"
                              onClick={saveOutreachToHistory}>
                              Зберегти в історію
                            </button>
                          </div>
                        </div>

                        <label className="notes">
                          Нотатки
                          <textarea
                            placeholder="Що обговорювали, коли передзвонити…"
                            value={selected.notes}
                            onChange={(e) => updateCompany(selected.id, { notes: e.target.value })}
                          />
                        </label>
                      </>
                    )}
                  </aside>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="crm-layout">
            <section>
              <div className="crm-toolbar">
                <div>
                  <p className="eyebrow">Воронка продажів</p>
                  <h2>Ліди в роботі</h2>
                </div>
                <input
                  placeholder="Пошук за назвою, містом, email…"
                  value={crmFilter}
                  onChange={(e) => setCrmFilter(e.target.value)}
                />
              </div>
              {crmCompanies.length === 0 && (
                <div className="api-warning">
                  CRM порожня. Додайте потрібні компанії кнопкою «Додати в CRM» у картці ліда.
                </div>
              )}
              <section className="crm-board">
                {statuses.map((status) => (
                  <div
                    className="crm-column"
                    key={status}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => moveLead(e.dataTransfer.getData('lead-id'), status)}>
                    <div className="crm-title">
                      <strong>{status}</strong>
                      <span>
                        {filteredCrmCompanies.filter((company) => company.status === status).length}
                      </span>
                    </div>
                    {filteredCrmCompanies
                      .filter((company) => company.status === status)
                      .map((company) => (
                        <button
                          key={company.id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('lead-id', company.id)}
                          onClick={() => setCrmSelectedId(company.id)}>
                          <strong>{company.name}</strong>
                          <span>
                            {company.city} · {company.country}
                          </span>
                          <small>
                            {company.nextContact
                              ? `Наступний контакт: ${company.nextContact}`
                              : company.website || company.phone || company.email
                                ? 'Є контакти'
                                : 'Без контактів'}
                          </small>
                        </button>
                      ))}
                  </div>
                ))}
              </section>
            </section>

            <aside className="crm-detail">
              {!crmSelected ? (
                <div className="empty-state">
                  <strong>Оберіть ліда</strong>
                  <span>Тут з’являться контакти, нотатки, нагадування та історія.</span>
                </div>
              ) : (
                <>
                  <div className="detail-head">
                    <div>
                      <p className="eyebrow">Картка ліда</p>
                      <h2>{crmSelected.name}</h2>
                      <span className="muted">
                        {crmSelected.city} · {crmSelected.country}
                      </span>
                    </div>
                    <button
                      className="icon-button"
                      onClick={() => setCrmSelectedId(null)}>
                      ×
                    </button>
                  </div>
                  <div className="contact-grid">
                    <span>{crmSelected.email || 'Email не знайдено'}</span>
                    <span>{crmSelected.phone || 'Телефон не знайдено'}</span>
                    <span>{crmSelected.address}</span>
                  </div>
                  <div className="field-row">
                    <label>
                      Статус
                      <select
                        value={crmSelected.status}
                        onChange={(e) =>
                          changeStatus(crmSelected.id, e.target.value as LeadStatus)
                        }>
                        {statuses.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Наступний контакт
                      <input
                        type="date"
                        value={crmSelected.nextContact || ''}
                        onChange={(e) => {
                          updateCompany(crmSelected.id, { nextContact: e.target.value });
                          if (e.target.value)
                            addActivity(
                              crmSelected.id,
                              'reminder',
                              `Заплановано контакт на ${e.target.value}`,
                            );
                        }}
                      />
                    </label>
                  </div>
                  <label className="notes">
                    Нотатки
                    <textarea
                      placeholder="Домовленості, потреби, заперечення…"
                      value={crmSelected.notes}
                      onChange={(e) => updateCompany(crmSelected.id, { notes: e.target.value })}
                    />
                  </label>
                  <div className="activity-compose">
                    <textarea
                      placeholder="Додати запис до історії…"
                      value={activityText}
                      onChange={(e) => setActivityText(e.target.value)}
                    />
                    <div>
                      <button
                        className="secondary"
                        onClick={() => {
                          addActivity(crmSelected.id, 'note', activityText);
                          setActivityText('');
                        }}>
                        Нотатка
                      </button>
                      <button
                        className="secondary"
                        onClick={() => {
                          addActivity(crmSelected.id, 'contact', activityText);
                          setActivityText('');
                        }}>
                        Контакт
                      </button>
                      <button
                        className="secondary"
                        onClick={() => {
                          addActivity(crmSelected.id, 'reply', activityText);
                          setActivityText('');
                        }}>
                        Відповідь
                      </button>
                    </div>
                  </div>
                  <div className="activity-list">
                    <strong>Історія роботи</strong>
                    {(crmSelected.activities || []).length === 0 ? (
                      <p className="muted">Історія поки порожня.</p>
                    ) : (
                      (crmSelected.activities || []).map((activity) => (
                        <div
                          className="activity-item"
                          key={activity.id}>
                          <span>{new Date(activity.createdAt).toLocaleString()}</span>
                          <p>{activity.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <button
                    className="danger-button"
                    onClick={() => {
                      toggleCrm(crmSelected.id);
                      setCrmSelectedId(null);
                    }}>
                    Видалити з CRM
                  </button>
                </>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
