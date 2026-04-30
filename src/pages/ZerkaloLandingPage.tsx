import {
  PremiumHero, GoldLine, HowItWorksSection,
  BirthDateInputSection, MirrorAwakeningSection,
  FreeInsightSection, PremiumTeaserSection,
  BigResearchOfferSection, TrustSection,
  LeadFormSection, TelegramDeliverySection,
  MobileBottomCTA
} from '../components/premium/ZerkaloLanding';

export default function ZerkaloLandingPage() {
  return (
    <div className="dark-mirror">
      <PremiumHero />
      <GoldLine />
      <HowItWorksSection />
      <GoldLine />
      <BirthDateInputSection />
      <MirrorAwakeningSection />
      <GoldLine />
      <FreeInsightSection />
      <GoldLine />
      <PremiumTeaserSection />
      <GoldLine />
      <BigResearchOfferSection />
      <TrustSection />
      <GoldLine />
      <LeadFormSection />
      <TelegramDeliverySection />
      <MobileBottomCTA />
    </div>
  );
}
