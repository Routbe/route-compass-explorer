type LocalizedString = { defaultValue: { language: string; value: string }; translatedValues: { language: string; value: string }[] };
export type GoogleImage = { sourceUri: { uri: string }; contentDescription: LocalizedString };
export type GoogleTextModule = { id: string; body?: string; localizedHeader: LocalizedString; localizedBody?: LocalizedString };
export type GoogleGenericObject = {
  id: string; classId: string; state: "ACTIVE";
  hexBackgroundColor: string; logo: GoogleImage; heroImage: GoogleImage;
  cardTitle: LocalizedString; header: LocalizedString; subheader: LocalizedString;
  textModulesData: GoogleTextModule[];
  barcode: { type: "QR_CODE"; value: string; alternateText: string };
  imageModulesData?: { id: string; mainImage: GoogleImage }[];
  linksModuleData: { uris: { uri: string; localizedDescription: LocalizedString; id: string }[] };
};
export type GoogleCardRow = { oneItem: { item: { firstValue: { fields: { fieldPath: string }[] } } } };
export type GoogleGenericClass = { id: string; classTemplateInfo: { cardTemplateOverride: { cardRowTemplateInfos: GoogleCardRow[] } } };
export type GoogleCardClaims = { iss: string; aud: "google"; typ: "savetowallet"; origins: string[]; payload: { genericClasses: GoogleGenericClass[]; genericObjects: GoogleGenericObject[] } };