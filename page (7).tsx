import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import StatsSection from './components/StatsSection';
import FeaturesSection from './components/FeaturesSection';
import TestimonialsSection from './components/TestimonialsSection';
import PricingSection from './components/PricingSection';
import LeadMagnet from './components/LeadMagnet';
import Footer from './components/Footer';
import JsonLd from '@/components/feature/JsonLd';

const siteUrl = import.meta.env.VITE_SITE_URL || 'https://sentiqs.com';

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'SentiqS',
  url: siteUrl,
  description: "Plateforme d'aide à la décision pour responsables sûreté. Veille active sur 54 pays d'Afrique.",
  knowsAbout: [
    'Veille sûreté',
    'Analyse de risques',
    'Sécurité Afrique',
    'Renseignement stratégique',
  ],
  areaServed: {
    '@type': 'Continent',
    name: 'Africa',
  },
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'SentiqS',
  url: siteUrl,
  description: "Plateforme d'Analyse Sûreté Pays et d'aide à la décision pour responsables sûreté couvrant 54 pays d'Afrique.",
  inLanguage: ['fr', 'en'],
};

export default function Home() {
  return (
    <>
      <JsonLd data={organizationSchema as unknown as Record<string, unknown>} />
      <JsonLd data={websiteSchema as unknown as Record<string, unknown>} />
      <div className="min-h-screen w-full bg-white flex flex-col">
        <Navbar />
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <TestimonialsSection />
        <PricingSection />
        <LeadMagnet />
        <Footer />
      </div>
    </>
  );
}