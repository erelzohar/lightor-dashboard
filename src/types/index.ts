export interface Address {
  state: string;
  city: string;
  street: string;
  other: string;
}

export interface Contact {
  phone: string;
  mail: string;
}

export interface Social {
  instagram: string;
  facebook: string;
  x: string;
  tiktok: string;
}

export interface Palette {
  colorPrimary: string;
  colorPrimaryDark: string;
  colorLightBg: string;
  colorLightSurface: string;
  colorLightGray: string;
  colorLightText: string;
  colorDarkBg: string;
  colorDarkSurface: string;
  colorDarkGray: string;
  colorDarkText: string;
}

export interface NavbarConfig {
  visible: boolean;
  darkMode: boolean;
  languageSwitcher: boolean;
}

export interface HeroConfig {
  visible: boolean;
  title: string;
  subtitle: string;
  description: string;
  heroImageSrc: string;
}

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

export interface AboutConfig {
  visible: boolean;
  title: string;
  description: string;
  paragraphs: {
    intro: string;
    mission: string;
  };
  features: FeatureItem[];
}

export interface PortfolioItem {
  url: string;
  title: string;
  description: string;
}

export interface PortfolioConfig {
  visible: boolean;
  isGrid: boolean;
  title: string;
  description: string;
  items: PortfolioItem[];
}

export interface ScheduleConfig {
  title: string;
  description: string;
  // minsPerAppo: number;
}

export interface ContactConfig {
  visible: boolean;
  title: string;
  description: string;
}

export interface FooterConfig {
  visible: boolean;
  description: string;
}

export interface IntroPopupConfig {
  visible: boolean;
  value: string;
}

export interface ContactButtonConfig {
  visible: boolean;
}

export interface ComponentsConfig {
  navbar: NavbarConfig;
  hero: HeroConfig;
  about: AboutConfig;
  portfolio: PortfolioConfig;
  schedule: ScheduleConfig;
  contact: ContactConfig;
  footer: FooterConfig;
  introPopup: IntroPopupConfig;
  contactButton: ContactButtonConfig;
}
export interface Vacation {
  _id?: string;
  title: string;
  startDate: string; // Epoch timestamp as string
  endDate: string;   // Epoch timestamp as string
  webConfig_id:string;
}
export interface WebConfig {
  _id: string;
  user_id: string;
  businessName: string;
  logoImageName: string;
  vacations:Vacation[];
  appointmentTypes:AppointmentType[]
  subDomain: string;
  minCancelTimeMS: number;
  minsPerSlot: number;
  defaultLanguage: string;
  workingDays: (string | null)[];
  address: Address;
  contact: Contact;
  social: Social;
  pallete: Palette;
  components: ComponentsConfig;
}

export interface User {
  _id: string;
  username: string;
  password: string;
  webConfig_id: string;
  email: string;
  phone: string;
  subscription: string;
  name: string;
  defaultLanguage: string;
}

export interface AppointmentType {
  _id: string;
  name: string;
  webConfig_id: string;
  price: string;
  durationMS: string;
}

export interface Appointment {
  _id: string;
  name: string;
  type: AppointmentType;
  phone: string;
  status: string;
  user_id: string;
  timestamp: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}