/**
 * Google Places Autocomplete (New) behind one small door (LT-191).
 *
 * A MIRROR of lightor-front's src/services/places.ts, for the owner's own
 * bookings (LT-206): the two apps share no package, so a fix to one belongs
 * in the other too. The key is the same referrer-restricted browser key.
 *
 * The address question on the booking form suggests real addresses as the
 * customer types. Everything that touches Google lives here — the script
 * loader and the two calls the widget makes — so the component stays a
 * plain combobox and the tests mock this one module.
 *
 * Only the new API is used: the legacy `places.Autocomplete` widget and
 * `AutocompleteService` are closed to new customers since March 2025.
 *
 * Every function here rejects on failure rather than hiding it. The widget
 * needs to know Google is unreachable so it can drop back to free text
 * (the LT-098 lesson: degrade, never block) instead of insisting on an
 * address the customer had no way of choosing.
 */

const SCRIPT_URL = 'https://maps.googleapis.com/maps/api/js';

/** A blocked or slow script must not hold the form: past this, the field is plain text. */
const LOAD_TIMEOUT_MS = 5000;

/**
 * The public key, read at call time so tests can stub the env. Empty means
 * the feature is off and nothing here is ever called.
 */
export const placesKey = (): string => String(import.meta.env.VITE_GOOGLE_MAPS_KEY ?? '').trim();

// The slice of google.maps.places this module touches, declared here rather
// than pulling in @types/google.maps for a handful of properties.
interface FormattableText {
  toString(): string;
}

interface PlaceLocation {
  lat: number | (() => number);
  lng: number | (() => number);
}

interface Place {
  id: string | null;
  formattedAddress: string | null;
  location: PlaceLocation | null;
  fetchFields(request: { fields: string[] }): Promise<unknown>;
}

export interface PlacePrediction {
  placeId: string;
  text: FormattableText;
  mainText: FormattableText | null;
  secondaryText: FormattableText | null;
  toPlace(): Place;
}

interface AutocompleteRequest {
  input: string;
  sessionToken?: object;
  language?: string;
}

interface PlacesLibrary {
  AutocompleteSessionToken: new () => object;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(
      request: AutocompleteRequest
    ): Promise<{ suggestions: Array<{ placePrediction: PlacePrediction | null }> }>;
  };
}

interface MapsNamespace {
  importLibrary?: (name: string) => Promise<unknown>;
  __ib__?: () => void;
}

const mapsNamespace = (): MapsNamespace => {
  const root = window as unknown as { google?: { maps?: MapsNamespace } };
  const google = (root.google ??= {});
  return (google.maps ??= {});
};

/**
 * Injects the API script: a readable port of Google's dynamic bootstrap
 * loader — the same URL and parameters, the same `callback=google.maps.__ib__`
 * handshake, after which `importLibrary` is the real one. Reuses an API
 * something else on the page already loaded.
 */
const inject = (key: string): Promise<MapsNamespace> =>
  new Promise((resolve, reject) => {
    const maps = mapsNamespace();
    if (maps.importLibrary) {
      resolve(maps);
      return;
    }
    const params = new URLSearchParams({
      key,
      v: 'weekly',
      libraries: 'places',
      loading: 'async',
      callback: 'google.maps.__ib__',
    });
    maps.__ib__ = () => {
      delete maps.__ib__;
      resolve(maps);
    };
    const tag = document.createElement('script');
    tag.src = `${SCRIPT_URL}?${params}`;
    tag.async = true;
    tag.nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce || '';
    tag.onerror = () => reject(new Error('The Google Maps JavaScript API could not load.'));
    document.head.append(tag);
  });

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The Google Maps JavaScript API took too long to load.')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

let library: Promise<PlacesLibrary> | null = null;

/**
 * The places library, fetched once and shared. A script that failed
 * outright may be tried again by a later call; one that is merely slow is
 * never injected twice — the timeout is per call, the load is shared.
 */
const placesLibrary = (): Promise<PlacesLibrary> => {
  const key = placesKey();
  if (!key) return Promise.reject(new Error('No Google Maps key is configured.'));
  if (!library) {
    library = inject(key)
      .then((maps) => maps.importLibrary('places') as Promise<PlacesLibrary>)
      .catch((error) => {
        library = null;
        throw error;
      });
  }
  return withTimeout(library, LOAD_TIMEOUT_MS);
};

/** Loads the library ahead of the first keystroke. Rejects without a key, on a blocked script, or after LOAD_TIMEOUT_MS. */
export const loadPlaces = (): Promise<void> => placesLibrary().then(() => undefined);

/**
 * One autocomplete session: the token groups every keystroke with the
 * selection that ends it, which is how Google bills it. Created on first
 * use; the widget hands over a fresh, empty one after each choice.
 */
export interface AddressSession {
  token?: object;
}

export interface AddressSuggestion {
  placeId: string;
  /** The whole prediction, e.g. "Herzl 12, Tel Aviv-Yafo, Israel". */
  text: string;
  /** The street and number. */
  mainText: string;
  /** The city and country. */
  secondaryText: string;
  /** Google's own prediction, kept so the choice can be resolved. Absent in tests. */
  prediction?: PlacePrediction;
}

export interface ResolvedAddress {
  placeId: string;
  lat: number;
  lng: number;
}

const asText = (value: FormattableText | string | null | undefined): string => (value == null ? '' : String(value));

/** The predictions for what the customer has typed so far, in Google's order. */
export const fetchAddressSuggestions = async (
  input: string,
  options: { language: string; session: AddressSession }
): Promise<AddressSuggestion[]> => {
  const places = await placesLibrary();
  options.session.token ??= new places.AutocompleteSessionToken();
  // No country restriction (LT-192): without one Google biases by the
  // customer's IP, so an Israeli customer sees Israel first and a customer
  // abroad sees their own country — a home-visit business anywhere works.
  const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    sessionToken: options.session.token,
    language: options.language,
  });
  return (suggestions ?? []).flatMap(({ placePrediction }) => {
    if (!placePrediction?.placeId) return [];
    const text = asText(placePrediction.text);
    return [
      {
        placeId: placePrediction.placeId,
        text,
        mainText: asText(placePrediction.mainText) || text,
        secondaryText: asText(placePrediction.secondaryText),
        prediction: placePrediction,
      },
    ];
  });
};

/** `location.lat` is a method on a LatLng and a number on a literal; either way, a finite number or nothing. */
const coordinate = (location: PlaceLocation, axis: 'lat' | 'lng'): number | null => {
  const raw = location[axis];
  const value = typeof raw === 'function' ? raw.call(location) : raw;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

/**
 * The chosen prediction as a place: its id and coordinates. The address text
 * itself stays the suggestion's own line — the one the customer read and
 * chose. Place Details would answer in the language the API was loaded with,
 * which is how a Hebrew pick used to come back in English (LT-192).
 */
export const resolveAddressSuggestion = async (suggestion: AddressSuggestion): Promise<ResolvedAddress> => {
  if (!suggestion.prediction) throw new Error('The suggestion carries no place to resolve.');
  const place = suggestion.prediction.toPlace();
  await place.fetchFields({ fields: ['location', 'id'] });
  const lat = place.location ? coordinate(place.location, 'lat') : null;
  const lng = place.location ? coordinate(place.location, 'lng') : null;
  if (lat === null || lng === null) throw new Error('The place has no location.');
  return { placeId: place.id || suggestion.placeId, lat, lng };
};
