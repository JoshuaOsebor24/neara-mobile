import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  StoreLocationPicker,
  type StoreCoordinates,
} from "@/components/map/store-location-picker";
import { theme } from "@/constants/theme";
import {
  buildSessionPatchFromAuthUser,
  buildSessionPatchFromStore,
  registerOwnerWithBackend,
  signupWithBackend,
  updateCurrentUserWithBackend,
} from "@/services/auth-api";
import {
  getCurrentUserLocation,
  requestForegroundLocationPermission,
} from "@/services/location";
import {
  updateMobileSession,
  useMobileSession,
} from "@/services/mobile-session";
import {
  fetchPlaceSuggestions,
  geocodePlace,
  getPlaceAutocompleteErrorDetails,
  hasPlaceAutocompleteToken,
  type PlaceSuggestion,
} from "@/services/place-autocomplete";
import { createStoreWithBackend } from "@/services/store-api";

type RegisterErrors = {
  address?: string;
  category?: string;
  confirmPassword?: string;
  country?: string;
  description?: string;
  email?: string;
  location?: string;
  name?: string;
  ownerPhone?: string;
  password?: string;
  stateRegion?: string;
  storeName?: string;
  storePhone?: string;
};

type Notice = {
  text: string;
  type: "error" | "success";
} | null;

type OwnerSignupStep = 0 | 1 | 2;
type AddressSearchState = "idle" | "loading" | "ready" | "empty" | "error";

const OWNER_STEP_META = [
  {
    description: "Review and complete your account details",
    title: "Account details",
  },
  {
    description: "Add your store details",
    title: "Store details",
  },
  {
    description: "Find the place and confirm the final pin",
    title: "Confirm location",
  },
] as const;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getRegisterFieldError(
  field:
    | "name"
    | "email"
    | "password"
    | "confirmPassword"
    | "ownerPhone"
    | "storeName"
    | "category"
    | "storePhone"
    | "country"
    | "stateRegion"
    | "address"
    | "description",
  value: string,
  passwordValue = "",
) {
  if (field === "name") {
    return value.trim() ? undefined : "Name is required.";
  }

  if (field === "email") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return "Email is required.";
    }

    return isValidEmail(trimmedValue) ? undefined : "Enter a valid email.";
  }

  if (field === "password") {
    if (!value.trim()) {
      return undefined;
    }

    return value.length >= 6
      ? undefined
      : "Use a password with at least 6 characters.";
  }

  if (field === "confirmPassword") {
    if (!passwordValue.trim() && !value.trim()) {
      return undefined;
    }

    if (!passwordValue.trim()) {
      return "Enter your new password first.";
    }

    if (!value.trim()) {
      return "Confirm your new password.";
    }

    return value === passwordValue ? undefined : "Passwords do not match.";
  }

  if (field === "ownerPhone" || field === "storePhone") {
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      return field === "ownerPhone"
        ? "Owner phone is required."
        : "Store phone is required.";
    }

    return digits.length >= 7 ? undefined : "Enter a valid phone number.";
  }

  if (field === "storeName") {
    return value.trim() ? undefined : "Store name is required.";
  }

  if (field === "category") {
    return value.trim() ? undefined : "Store category is required.";
  }

  if (field === "country") {
    return value.trim() ? undefined : "Country is required.";
  }

  if (field === "stateRegion") {
    return value.trim() ? undefined : "State / city is required.";
  }

  if (field === "address") {
    if (!value.trim()) {
      return undefined;
    }

    return value.trim().length >= 3
      ? undefined
      : "Enter a clearer location search.";
  }

  if (field === "description") {
    return value.trim() ? undefined : "Store description is required.";
  }

  return undefined;
}

const STORE_CATEGORY_OPTIONS = [
  "Grocery",
  "Bakery",
  "Pharmacy",
  "Restaurant",
  "Beauty",
  "Electronics",
  "Home",
  "Fashion",
  "Services",
];

const ADDRESS_SEARCH_DEBOUNCE_MS = 260;
const STORE_IMAGE_LIMIT = 3;

function buildStoreImageSlots(images: string[]) {
  const normalized = images.filter(Boolean).slice(0, STORE_IMAGE_LIMIT);

  if (normalized.length >= STORE_IMAGE_LIMIT) {
    return normalized;
  }

  return [...normalized, ""];
}

function buildAddressLookupQuery(
  address: string,
  stateRegion: string,
  country: string,
) {
  const normalizedAddress = address.trim();
  const normalizedAddressLower = normalizedAddress.toLowerCase();

  return [normalizedAddress, stateRegion.trim(), country.trim()]
    .filter(Boolean)
    .filter((value, index) => {
      if (index === 0) {
        return true;
      }

      return !normalizedAddressLower.includes(value.toLowerCase());
    })
    .join(", ");
}

export default function SignupScreen() {
  const router = useRouter();
  const session = useMobileSession();
  const params = useLocalSearchParams<{
    paymentStatus?: string;
    storePlan?: string;
  }>();
  const selectedStorePlan =
    params.storePlan === "basic"
      ? params.storePlan
      : session.storePlan === "basic"
        ? session.storePlan
        : null;
  const [name, setName] = useState(session.name || "");
  const [email, setEmail] = useState(session.email || "");
  const [ownerPhone, setOwnerPhone] = useState(session.phoneNumber || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [storeName, setStoreName] = useState(session.primaryStoreName || "");
  const [category, setCategory] = useState(
    session.primaryStoreCategory || STORE_CATEGORY_OPTIONS[0],
  );
  const [storePhone, setStorePhone] = useState(session.storePhoneNumber || "");
  const [country, setCountry] = useState("Nigeria");
  const [stateRegion, setStateRegion] = useState("");
  const [address, setAddress] = useState(session.primaryStoreAddress || "");
  const [description, setDescription] = useState("");
  const [storeImages, setStoreImages] = useState<string[]>(
    session.primaryStoreImageUrl ? [session.primaryStoreImageUrl] : [],
  );
  const [ownerStep, setOwnerStep] = useState<OwnerSignupStep>(0);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationCoordinates, setLocationCoordinates] =
    useState<StoreCoordinates | null>(null);
  const [locationMessage, setLocationMessage] = useState(
    "Add an address, use current location, or place the pin manually on the map.",
  );
  const [isLocationConfirmed, setIsLocationConfirmed] = useState(false);
  const [isUsingCurrentLocation, setIsUsingCurrentLocation] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<
    PlaceSuggestion[]
  >([]);
  const [addressSearchState, setAddressSearchState] =
    useState<AddressSearchState>("idle");
  const [addressSearchErrorMessage, setAddressSearchErrorMessage] =
    useState("");
  const [isAddressSearching, setIsAddressSearching] = useState(false);
  const [isAddressInputFocused, setIsAddressInputFocused] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(
    null,
  );
  const addressSearchRequestIdRef = useRef(0);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedOwnerPhone = ownerPhone.trim();
  const trimmedPassword = password.trim();
  const trimmedStoreName = storeName.trim();
  const trimmedCategory = category.trim();
  const trimmedStorePhone = storePhone.trim();
  const trimmedCountry = country.trim();
  const trimmedStateRegion = stateRegion.trim();
  const trimmedAddress = address.trim();
  const trimmedDescription = description.trim();
  const imageSlots = useMemo(
    () => buildStoreImageSlots(storeImages),
    [storeImages],
  );
  const canSubmit = selectedStorePlan
    ? trimmedName.length > 0 &&
      trimmedEmail.length > 0 &&
      trimmedOwnerPhone.length > 0 &&
      trimmedStoreName.length > 0 &&
      trimmedCategory.length > 0 &&
      trimmedStorePhone.length > 0 &&
      trimmedCountry.length > 0 &&
      trimmedStateRegion.length > 0 &&
      trimmedDescription.length > 0 &&
      !errors.name &&
      !errors.email &&
      !errors.password &&
      !errors.confirmPassword &&
      !errors.ownerPhone &&
      !errors.storeName &&
      !errors.category &&
      !errors.storePhone &&
      !errors.country &&
      !errors.stateRegion &&
      !errors.description &&
      !isSubmitting
    : trimmedName.length > 0 &&
      trimmedEmail.length > 0 &&
      trimmedPassword.length >= 6 &&
      confirmPassword.trim().length > 0 &&
      !errors.name &&
      !errors.email &&
      !errors.password &&
      !errors.confirmPassword &&
      !isSubmitting;

  const canContinueOwnerStep =
    trimmedName.length > 0 &&
    trimmedEmail.length > 0 &&
    trimmedOwnerPhone.length > 0 &&
    !errors.name &&
    !errors.email &&
    !errors.password &&
    !errors.confirmPassword &&
    !errors.ownerPhone &&
    !isSubmitting;
  const canContinueStoreStep =
    trimmedStoreName.length > 0 &&
    trimmedCategory.length > 0 &&
    trimmedStorePhone.length > 0 &&
    trimmedCountry.length > 0 &&
    trimmedStateRegion.length > 0 &&
    trimmedDescription.length > 0 &&
    !errors.storeName &&
    !errors.category &&
    !errors.storePhone &&
    !errors.country &&
    !errors.stateRegion &&
    !errors.description &&
    !isSubmitting;

  const primaryActionDisabled = selectedStorePlan
    ? ownerStep === 0
      ? !canContinueOwnerStep
      : ownerStep === 1
        ? !canContinueStoreStep
        : !(
            Boolean(locationCoordinates) &&
            isLocationConfirmed &&
            !isSubmitting
          )
    : !canSubmit;

  const activeOwnerStep = OWNER_STEP_META[ownerStep];
  const addressLookupQuery = useMemo(
    () => buildAddressLookupQuery(address, stateRegion, country),
    [address, country, stateRegion],
  );
  const canShowAddressSuggestions =
    ownerStep === 2 &&
    isAddressInputFocused &&
    (isAddressSearching ||
      addressSuggestions.length > 0 ||
      addressSearchState === "empty" ||
      addressSearchState === "error");

  useEffect(() => {
    if (selectedStorePlan && params.paymentStatus === "success") {
      setNotice({
        text: "Payment confirmed. Continue your store registration.",
        type: "success",
      });
    }
  }, [params.paymentStatus, selectedStorePlan]);

  useEffect(() => {
    if (ownerStep !== 2) {
      setAddressSuggestions([]);
      setAddressSearchState("idle");
      setAddressSearchErrorMessage("");
      setIsAddressSearching(false);
      return;
    }

    const rawAddress = address.trim();

    if (rawAddress.length < 3) {
      setAddressSuggestions([]);
      setIsAddressSearching(false);

      if (!hasPlaceAutocompleteToken() && rawAddress.length > 0) {
        setAddressSearchState("error");
        setAddressSearchErrorMessage(
          "Place search is unavailable right now. You can still place the pin manually.",
        );
      } else {
        setAddressSearchState("idle");
        setAddressSearchErrorMessage("");
      }

      return;
    }

    if (!hasPlaceAutocompleteToken()) {
      setAddressSuggestions([]);
      setAddressSearchState("error");
      setAddressSearchErrorMessage(
        "Place search is unavailable right now. You can still place the pin manually.",
      );
      return;
    }

    let isCancelled = false;
    const requestId = addressSearchRequestIdRef.current + 1;
    addressSearchRequestIdRef.current = requestId;
    const timeoutId = setTimeout(async () => {
      setIsAddressSearching(true);
      setAddressSearchState("loading");
      setAddressSearchErrorMessage("");

      try {
        const suggestions = await fetchPlaceSuggestions({
          proximity: locationCoordinates,
          query: addressLookupQuery,
        });

        if (isCancelled || requestId !== addressSearchRequestIdRef.current) {
          return;
        }

        const seen = new Set<string>();
        const nextSuggestions = suggestions.filter((suggestion) => {
          const key = suggestion.id || suggestion.label;

          if (seen.has(key)) {
            return false;
          }

          seen.add(key);
          return true;
        });

        setAddressSuggestions(nextSuggestions);
        setAddressSearchState(nextSuggestions.length > 0 ? "ready" : "empty");
      } catch (error) {
        if (isCancelled) {
          return;
        }

        const details = getPlaceAutocompleteErrorDetails(error);
        const message =
          error instanceof Error
            ? error.message
            : "We couldn’t load place suggestions right now.";

        console.warn("[signup] place autocomplete failed", {
          error: message,
          query: addressLookupQuery,
          status: details?.status,
          url: details?.url,
        });

        setAddressSuggestions([]);
        setAddressSearchState("error");
        setAddressSearchErrorMessage(
          message || "We couldn’t load place suggestions right now.",
        );
      } finally {
        if (!isCancelled) {
          setIsAddressSearching(false);
        }
      }
    }, ADDRESS_SEARCH_DEBOUNCE_MS);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [address, addressLookupQuery, locationCoordinates, ownerStep]);

  const setFieldValue = (
    field:
      | "name"
      | "email"
      | "password"
      | "confirmPassword"
      | "ownerPhone"
      | "storeName"
      | "category"
      | "storePhone"
      | "country"
      | "stateRegion"
      | "address"
      | "description",
    value: string,
  ) => {
    if (field === "name") {
      setName(value);
    } else if (field === "email") {
      setEmail(value);
    } else if (field === "ownerPhone") {
      setOwnerPhone(value);
    } else if (field === "confirmPassword") {
      setConfirmPassword(value);
    } else if (field === "storeName") {
      setStoreName(value);
    } else if (field === "category") {
      setCategory(value);
    } else if (field === "storePhone") {
      setStorePhone(value);
    } else if (field === "country") {
      setCountry(value);
    } else if (field === "stateRegion") {
      setStateRegion(value);
    } else if (field === "address") {
      setAddress(value);
      setIsLocationConfirmed(false);
      setLocationMessage("Address updated. Confirm the pin again.");
      setAddressSearchErrorMessage("");
    } else if (field === "description") {
      setDescription(value);
    } else {
      setPassword(value);
    }

    setErrors((current) => {
      const next = { ...current };
      const fieldError = getRegisterFieldError(
        field,
        value,
        field === "password" ? value : password,
      );

      if (fieldError) {
        next[field] = fieldError;
      } else {
        delete next[field];
      }

      if (field === "password" || field === "confirmPassword") {
        const nextPassword = field === "password" ? value : password;
        const nextConfirmPassword =
          field === "confirmPassword" ? value : confirmPassword;
        const confirmPasswordError = getRegisterFieldError(
          "confirmPassword",
          nextConfirmPassword,
          nextPassword,
        );

        if (confirmPasswordError) {
          next.confirmPassword = confirmPasswordError;
        } else {
          delete next.confirmPassword;
        }
      }

      return next;
    });
    setNotice(null);
  };

  const handleFieldBlur = (
    field:
      | "name"
      | "email"
      | "password"
      | "confirmPassword"
      | "ownerPhone"
      | "storeName"
      | "category"
      | "storePhone"
      | "country"
      | "stateRegion"
      | "address"
      | "description",
  ) => {
    const value =
      field === "name"
        ? name
        : field === "email"
          ? email
          : field === "password"
            ? password
            : field === "confirmPassword"
              ? confirmPassword
              : field === "ownerPhone"
                ? ownerPhone
                : field === "storeName"
                  ? storeName
                  : field === "category"
                    ? category
                    : field === "storePhone"
                      ? storePhone
                      : field === "country"
                        ? country
                        : field === "stateRegion"
                          ? stateRegion
                          : field === "description"
                            ? description
                            : address;

    setErrors((current) => {
      const next = { ...current };
      const fieldError = getRegisterFieldError(field, value, password);

      if (fieldError) {
        next[field] = fieldError;
      } else {
        delete next[field];
      }

      return next;
    });
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    const nextErrors: RegisterErrors = {};
    const nameError = getRegisterFieldError("name", name);
    const emailError = getRegisterFieldError("email", email);
    const passwordError = getRegisterFieldError("password", password);
    const confirmPasswordError = getRegisterFieldError(
      "confirmPassword",
      confirmPassword,
      password,
    );
    const ownerPhoneError = selectedStorePlan
      ? getRegisterFieldError("ownerPhone", ownerPhone)
      : undefined;
    const storeNameError = selectedStorePlan
      ? getRegisterFieldError("storeName", storeName)
      : undefined;
    const categoryError = selectedStorePlan
      ? getRegisterFieldError("category", category)
      : undefined;
    const storePhoneError = selectedStorePlan
      ? getRegisterFieldError("storePhone", storePhone)
      : undefined;
    const countryError = selectedStorePlan
      ? getRegisterFieldError("country", country)
      : undefined;
    const stateRegionError = selectedStorePlan
      ? getRegisterFieldError("stateRegion", stateRegion)
      : undefined;
    const descriptionError = selectedStorePlan
      ? getRegisterFieldError("description", description)
      : undefined;
    const locationError =
      selectedStorePlan && (!locationCoordinates || !isLocationConfirmed)
        ? "Confirm your store location."
        : undefined;

    if (nameError) {
      nextErrors.name = nameError;
    }
    if (emailError) {
      nextErrors.email = emailError;
    }
    if (passwordError) {
      nextErrors.password = passwordError;
    }
    if (confirmPasswordError) {
      nextErrors.confirmPassword = confirmPasswordError;
    }
    if (ownerPhoneError) {
      nextErrors.ownerPhone = ownerPhoneError;
    }
    if (storeNameError) {
      nextErrors.storeName = storeNameError;
    }
    if (categoryError) {
      nextErrors.category = categoryError;
    }
    if (storePhoneError) {
      nextErrors.storePhone = storePhoneError;
    }
    if (countryError) {
      nextErrors.country = countryError;
    }
    if (stateRegionError) {
      nextErrors.stateRegion = stateRegionError;
    }
    if (descriptionError) {
      nextErrors.description = descriptionError;
    }
    if (locationError) {
      nextErrors.location = locationError;
    }

    setErrors(nextErrors);

    if (
      nameError ||
      emailError ||
      passwordError ||
      confirmPasswordError ||
      ownerPhoneError ||
      storeNameError ||
      categoryError ||
      storePhoneError ||
      countryError ||
      stateRegionError ||
      descriptionError ||
      locationError ||
      !canSubmit
    ) {
      setNotice(null);
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    if (!selectedStorePlan) {
      const result = await signupWithBackend({
        email: trimmedEmail.toLowerCase(),
        name: trimmedName,
        password,
      });

      if (!result.ok) {
        setIsSubmitting(false);
        setNotice({
          type: "error",
          text: result.error,
        });
        return;
      }

      updateMobileSession(
        buildSessionPatchFromAuthUser(result.user, result.token),
      );
      setIsSubmitting(false);
      setNotice({
        type: "success",
        text: result.message || "Account created successfully.",
      });
      router.replace("/");
      return;
    }

    if (session.isAuthenticated && session.authToken) {
      const accountUpdateResult = await updateCurrentUserWithBackend(
        session.authToken,
        {
          email: trimmedEmail.toLowerCase(),
          name: trimmedName,
          password: trimmedPassword || undefined,
          phone_number: trimmedOwnerPhone,
        },
      );

      if (!accountUpdateResult.ok) {
        setIsSubmitting(false);
        setNotice({
          type: "error",
          text: accountUpdateResult.error,
        });
        return;
      }

      updateMobileSession(
        buildSessionPatchFromAuthUser(
          accountUpdateResult.user,
          session.authToken,
        ),
      );

      const normalizedStoreImages = storeImages
        .filter(Boolean)
        .slice(0, STORE_IMAGE_LIMIT);
      const storeCreateResult = await createStoreWithBackend(
        session.authToken,
        {
          address: trimmedAddress,
          category: trimmedCategory,
          country: trimmedCountry,
          description: trimmedDescription,
          header_images: normalizedStoreImages,
          image_url: normalizedStoreImages[0] || null,
          latitude: locationCoordinates?.latitude ?? null,
          longitude: locationCoordinates?.longitude ?? null,
          phone_number: trimmedStorePhone,
          state: trimmedStateRegion,
          store_name: trimmedStoreName,
        },
      );

      if (!storeCreateResult.ok || !storeCreateResult.store) {
        setIsSubmitting(false);
        setNotice({
          type: "error",
          text: storeCreateResult.error || "Could not create your store.",
        });
        return;
      }

      updateMobileSession({
        ...buildSessionPatchFromStore(storeCreateResult.store),
        isStoreOwner: true,
        phoneNumber: trimmedOwnerPhone,
        storePlan: selectedStorePlan,
      });
      setIsSubmitting(false);
      setNotice({
        type: "success",
        text: storeCreateResult.message || "Store created successfully.",
      });
      router.replace(
        storeCreateResult.store.id
          ? `/store/${String(storeCreateResult.store.id)}`
          : "/(tabs)/home",
      );
      return;
    }

    const normalizedStoreImages = storeImages
      .filter(Boolean)
      .slice(0, STORE_IMAGE_LIMIT);
    const signupResult = await registerOwnerWithBackend({
      owner: {
        email: trimmedEmail.toLowerCase(),
        full_name: trimmedName,
        password,
        phone_number: trimmedOwnerPhone,
      },
      store: {
        address: trimmedAddress,
        category: trimmedCategory,
        country: trimmedCountry,
        description: trimmedDescription,
        header_images: normalizedStoreImages,
        image_url: normalizedStoreImages[0] || null,
        latitude: locationCoordinates?.latitude ?? null,
        longitude: locationCoordinates?.longitude ?? null,
        phone_number: trimmedStorePhone,
        state: trimmedStateRegion,
        store_name: trimmedStoreName,
      },
    });

    if (!signupResult.ok) {
      if (
        signupResult.status === 409 &&
        signupResult.token &&
        signupResult.user &&
        signupResult.store
      ) {
        updateMobileSession({
          ...buildSessionPatchFromAuthUser(
            signupResult.user,
            signupResult.token,
          ),
          ...buildSessionPatchFromStore(signupResult.store),
          isStoreOwner: true,
          phoneNumber: trimmedOwnerPhone,
          storePlan: selectedStorePlan,
        });
        setIsSubmitting(false);
        setNotice({
          type: "success",
          text: "You already have a store. Taking you to your store dashboard.",
        });
        router.replace(
          signupResult.store.id
            ? `/store/${String(signupResult.store.id)}`
            : "/(tabs)/home",
        );
        return;
      }

      setIsSubmitting(false);
      setNotice({
        type: "error",
        text: signupResult.error,
      });
      return;
    }

    updateMobileSession({
      ...buildSessionPatchFromAuthUser(signupResult.user, signupResult.token),
      phoneNumber: trimmedOwnerPhone,
      storePlan: selectedStorePlan,
    });

    updateMobileSession({
      ...buildSessionPatchFromStore(signupResult.store),
      isStoreOwner: true,
      phoneNumber: trimmedOwnerPhone,
      storePlan: selectedStorePlan,
    });
    setIsSubmitting(false);
    setNotice({
      type: "success",
      text: signupResult.message || "Store created successfully.",
    });
    router.replace(
      signupResult.store?.id
        ? `/store/${String(signupResult.store.id)}`
        : "/(tabs)/home",
    );
  };

  const validateOwnerStep = (step: OwnerSignupStep) => {
    const nextErrors: RegisterErrors = {};

    if (step === 0) {
      const nameError = getRegisterFieldError("name", name);
      const emailError = getRegisterFieldError("email", email);
      const passwordError = getRegisterFieldError("password", password);
      const confirmPasswordError = getRegisterFieldError(
        "confirmPassword",
        confirmPassword,
        password,
      );
      const ownerPhoneError = getRegisterFieldError("ownerPhone", ownerPhone);

      if (nameError) nextErrors.name = nameError;
      if (emailError) nextErrors.email = emailError;
      if (passwordError) nextErrors.password = passwordError;
      if (confirmPasswordError) {
        nextErrors.confirmPassword = confirmPasswordError;
      }
      if (ownerPhoneError) nextErrors.ownerPhone = ownerPhoneError;
    }

    if (step === 1) {
      const storeNameError = getRegisterFieldError("storeName", storeName);
      const categoryError = getRegisterFieldError("category", category);
      const storePhoneError = getRegisterFieldError("storePhone", storePhone);
      const countryError = getRegisterFieldError("country", country);
      const stateRegionError = getRegisterFieldError(
        "stateRegion",
        stateRegion,
      );
      const descriptionError = getRegisterFieldError(
        "description",
        description,
      );

      if (storeNameError) nextErrors.storeName = storeNameError;
      if (categoryError) nextErrors.category = categoryError;
      if (storePhoneError) nextErrors.storePhone = storePhoneError;
      if (countryError) nextErrors.country = countryError;
      if (stateRegionError) nextErrors.stateRegion = stateRegionError;
      if (descriptionError) nextErrors.description = descriptionError;
    }

    if (step === 2) {
      if (!locationCoordinates) {
        nextErrors.location = "Set your store pin before continuing.";
      } else if (!isLocationConfirmed) {
        nextErrors.location = "Confirm your store location to continue.";
      }
    }

    setErrors((current) => ({ ...current, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const handleContinueOwnerSignup = () => {
    if (ownerStep === 0) {
      if (!validateOwnerStep(0) || !canContinueOwnerStep) {
        setNotice(null);
        return;
      }

      setNotice(null);
      setOwnerStep(1);
      return;
    }

    if (ownerStep === 1) {
      if (!validateOwnerStep(1) || !canContinueStoreStep) {
        setNotice(null);
        return;
      }

      setNotice(null);
      setOwnerStep(2);
      return;
    }

    if (!validateOwnerStep(2)) {
      setNotice(null);
      return;
    }
  };

  const handleUseCurrentLocation = async () => {
    setIsUsingCurrentLocation(true);
    setNotice(null);
    setErrors((current) => {
      const next = { ...current };
      delete next.location;
      return next;
    });

    const permissionStatus = await requestForegroundLocationPermission();

    if (permissionStatus !== "granted") {
      setIsUsingCurrentLocation(false);
      setLocationMessage(
        "Location permission is denied. Place the pin manually or allow access and retry.",
      );
      setErrors((current) => ({
        ...current,
        location:
          "Location permission is denied. Place the pin manually or allow access and retry.",
      }));
      return;
    }

    try {
      const coordinates = await getCurrentUserLocation({ forceRefresh: true });
      setLocationCoordinates({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });
      setAddressSearchState("idle");
      setIsLocationConfirmed(false);
      setLocationMessage("Location found. Confirm the pin to continue.");
    } catch {
      setErrors((current) => ({
        ...current,
        location:
          "We couldn’t get your location. Place the pin manually on the map.",
      }));
      setLocationMessage(
        "We couldn’t get your location. Place the pin manually on the map.",
      );
    } finally {
      setIsUsingCurrentLocation(false);
    }
  };

  const handleMapChange = (coordinates: StoreCoordinates) => {
    setLocationCoordinates(coordinates);
    setIsLocationConfirmed(false);
    setLocationMessage("Pin updated. Confirm this location.");
    setErrors((current) => {
      const next = { ...current };
      delete next.location;
      return next;
    });
  };

  const handleSelectAddressSuggestion = async (suggestion: PlaceSuggestion) => {
    setIsAddressInputFocused(false);
    setAddressSuggestions([]);
    setAddressSearchErrorMessage("");

    try {
      const match = suggestion.coordinates
        ? {
            coordinates: suggestion.coordinates,
            formattedAddress: suggestion.placeName,
          }
        : await geocodePlace({
            proximity: locationCoordinates,
            query: suggestion.placeName,
          });

      if (!match?.coordinates) {
        throw new Error("We couldn’t load that place yet.");
      }

      setAddress(match.formattedAddress);
      setLocationCoordinates(match.coordinates);
      setAddressSearchState("ready");
      setIsLocationConfirmed(false);
      setLocationMessage(
        "Place selected. Adjust the pin if needed, then confirm.",
      );
      setErrors((current) => {
        const next = { ...current };
        delete next.address;
        delete next.location;
        return next;
      });
    } catch (error) {
      const details = getPlaceAutocompleteErrorDetails(error);
      const message =
        error instanceof Error
          ? error.message
          : "We couldn’t load the selected place.";

      console.warn("[signup] place selection failed", {
        error: message,
        status: details?.status,
        url: details?.url,
      });
      setAddressSearchState("error");
      setAddressSearchErrorMessage(message);
    }
  };

  const handleConfirmLocation = () => {
    if (!locationCoordinates) {
      setErrors((current) => ({
        ...current,
        location: "Set the store pin before confirming the location.",
      }));
      setLocationMessage(
        "Place the pin on the map before confirming the location.",
      );
      return;
    }

    setIsLocationConfirmed(true);
    setLocationMessage("Location confirmed.");
    setErrors((current) => {
      const next = { ...current };
      delete next.location;
      return next;
    });
  };

  const buildSelectedImageValue = (asset: ImagePicker.ImagePickerAsset) => {
    if (asset.base64) {
      const mimeType = asset.mimeType || "image/jpeg";
      return `data:${mimeType};base64,${asset.base64}`;
    }

    return asset.uri;
  };

  const handlePickStoreImage = async (
    slotIndex: number,
    mode: "camera" | "library",
  ) => {
    setIsPickingImage(true);
    setEditingImageIndex(slotIndex);
    setNotice(null);

    try {
      const permission =
        mode === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          mode === "camera"
            ? "Allow camera access to take a store photo."
            : "Allow photo library access to choose a store photo.",
        );
        setIsPickingImage(false);
        setEditingImageIndex(null);
        return;
      }

      const result =
        mode === "camera"
          ? await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [4, 3],
              base64: true,
              mediaTypes: ["images"],
              quality: 0.7,
            })
          : await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              aspect: [4, 3],
              base64: true,
              mediaTypes: ["images"],
              quality: 0.7,
            });

      if (result.canceled || !result.assets?.[0]) {
        setIsPickingImage(false);
        setEditingImageIndex(null);
        return;
      }

      const nextImage = buildSelectedImageValue(result.assets[0]);
      setStoreImages((current) => {
        const next = buildStoreImageSlots(current);
        next[slotIndex] = nextImage;
        return next.filter(Boolean).slice(0, STORE_IMAGE_LIMIT);
      });
      setErrors((current) => {
        const next = { ...current };
        return next;
      });
    } catch {
      Alert.alert(
        "Image unavailable",
        "We couldn't load that image right now.",
      );
    } finally {
      setIsPickingImage(false);
      setEditingImageIndex(null);
    }
  };

  const handleRemoveStoreImage = (slotIndex: number) => {
    setStoreImages((current) =>
      current.filter((_, index) => index !== slotIndex),
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.page}>
            <View style={styles.heroGlowPrimary} />
            <View style={styles.heroGlowSecondary} />
            <View style={styles.header}>
              <View style={styles.brandMark}>
                <View style={styles.brandGlow} />
                <Text style={styles.brandMarkText}>N</Text>
              </View>
              <Text style={styles.brandTitle}>Neara</Text>
              <Text style={styles.brandSubtitle}>
                {selectedStorePlan
                  ? "Complete your store setup and start selling on Neara"
                  : "Create your account and find stores near you"}
              </Text>
            </View>

            <View style={styles.formCard}>
              <View style={styles.introBlock}>
                <Text style={styles.introEyebrow}>
                  {selectedStorePlan ? "Store signup" : "Get started"}
                </Text>
                <Text style={styles.introText}>
                  {selectedStorePlan
                    ? "Complete your Basic store plan on your existing account."
                    : "Create your account. Unlock Chat for ₦1,000 / month later from your profile."}
                </Text>
                {selectedStorePlan && session.primaryStoreName ? (
                  <Text style={styles.resumeText}>
                    Continuing setup for {session.primaryStoreName}
                  </Text>
                ) : null}
              </View>

              {selectedStorePlan ? (
                <View style={[styles.notice, styles.noticeSuccess]}>
                  <Text style={styles.noticeText}>
                    Selected plan: Basic Store
                  </Text>
                </View>
              ) : null}

              <View style={styles.formStack}>
                {selectedStorePlan ? (
                  <View style={styles.stepPanel}>
                    <Text style={styles.stepCounter}>
                      Step {ownerStep + 1} of {OWNER_STEP_META.length}
                    </Text>
                    <View style={styles.stepRow}>
                      {OWNER_STEP_META.map((step, index) => {
                        const active = ownerStep === index;
                        const complete = ownerStep > index;

                        return (
                          <View
                            key={step.title}
                            style={[
                              styles.stepCard,
                              active && styles.stepCardActive,
                              complete && styles.stepCardComplete,
                            ]}
                          >
                            <Text
                              style={[
                                styles.stepTitle,
                                active && styles.stepTitleActive,
                                complete && styles.stepTitleActive,
                              ]}
                            >
                              {step.title}
                            </Text>
                            <Text
                              style={[
                                styles.stepDescription,
                                active && styles.stepDescriptionActive,
                              ]}
                            >
                              {step.description}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.sectionCardTitle}>
                        {activeOwnerStep.title}
                      </Text>
                      <Text style={styles.sectionCardSubtitle}>
                        {activeOwnerStep.description}
                      </Text>
                    </View>
                    {ownerStep === 0 ? (
                      <>
                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>Full Name</Text>
                          <View
                            style={[
                              styles.inputShell,
                              errors.name && styles.inputShellError,
                            ]}
                          >
                            <Ionicons
                              color="#64748b"
                              name="person-outline"
                              size={18}
                            />
                            <TextInput
                              onBlur={() => handleFieldBlur("name")}
                              onChangeText={(value) =>
                                setFieldValue("name", value)
                              }
                              placeholder="Your full name"
                              placeholderTextColor={theme.colors.mutedText}
                              selectionColor={theme.colors.accent}
                              style={styles.input}
                              value={name}
                            />
                          </View>
                          {errors.name ? (
                            <Text style={styles.errorText}>{errors.name}</Text>
                          ) : null}
                        </View>

                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>Email</Text>
                          <View
                            style={[
                              styles.inputShell,
                              errors.email && styles.inputShellError,
                            ]}
                          >
                            <Ionicons
                              color="#64748b"
                              name="mail-outline"
                              size={18}
                            />
                            <TextInput
                              autoCapitalize="none"
                              keyboardType="email-address"
                              onBlur={() => handleFieldBlur("email")}
                              onChangeText={(value) =>
                                setFieldValue("email", value)
                              }
                              placeholder="Your email"
                              placeholderTextColor={theme.colors.mutedText}
                              selectionColor={theme.colors.accent}
                              style={styles.input}
                              value={email}
                            />
                          </View>
                          {errors.email ? (
                            <Text style={styles.errorText}>{errors.email}</Text>
                          ) : null}
                        </View>

                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>
                            Change to a stronger password (optional)
                          </Text>
                          <View
                            style={[
                              styles.inputShell,
                              errors.password && styles.inputShellError,
                            ]}
                          >
                            <Ionicons
                              color="#64748b"
                              name="lock-closed-outline"
                              size={18}
                            />
                            <TextInput
                              autoCapitalize="none"
                              onBlur={() => handleFieldBlur("password")}
                              onChangeText={(value) =>
                                setFieldValue("password", value)
                              }
                              placeholder="Leave blank to keep your current password"
                              placeholderTextColor={theme.colors.mutedText}
                              secureTextEntry={!showPassword}
                              selectionColor={theme.colors.accent}
                              style={styles.input}
                              value={password}
                            />
                            <TouchableOpacity
                              activeOpacity={0.85}
                              onPress={() =>
                                setShowPassword((current) => !current)
                              }
                            >
                              <Ionicons
                                color="#94a3b8"
                                name={
                                  showPassword
                                    ? "eye-off-outline"
                                    : "eye-outline"
                                }
                                size={18}
                              />
                            </TouchableOpacity>
                          </View>
                          {errors.password ? (
                            <Text style={styles.errorText}>
                              {errors.password}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.helperText}>
                          You are already signed in. Only enter a new password
                          if you want to replace the current one.
                        </Text>

                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>
                            Confirm new password
                          </Text>
                          <View
                            style={[
                              styles.inputShell,
                              errors.confirmPassword && styles.inputShellError,
                            ]}
                          >
                            <Ionicons
                              color="#64748b"
                              name="shield-checkmark-outline"
                              size={18}
                            />
                            <TextInput
                              autoCapitalize="none"
                              onBlur={() => handleFieldBlur("confirmPassword")}
                              onChangeText={(value) =>
                                setFieldValue("confirmPassword", value)
                              }
                              placeholder="Repeat the new password"
                              placeholderTextColor={theme.colors.mutedText}
                              secureTextEntry={!showPassword}
                              selectionColor={theme.colors.accent}
                              style={styles.input}
                              value={confirmPassword}
                            />
                          </View>
                          {errors.confirmPassword ? (
                            <Text style={styles.errorText}>
                              {errors.confirmPassword}
                            </Text>
                          ) : null}
                        </View>

                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>Phone Number</Text>
                          <View
                            style={[
                              styles.inputShell,
                              errors.ownerPhone && styles.inputShellError,
                            ]}
                          >
                            <Ionicons
                              color="#64748b"
                              name="call-outline"
                              size={18}
                            />
                            <TextInput
                              keyboardType="phone-pad"
                              onBlur={() => handleFieldBlur("ownerPhone")}
                              onChangeText={(value) =>
                                setFieldValue("ownerPhone", value)
                              }
                              placeholder="+1 555 123 4567"
                              placeholderTextColor={theme.colors.mutedText}
                              selectionColor={theme.colors.accent}
                              style={styles.input}
                              value={ownerPhone}
                            />
                          </View>
                          {errors.ownerPhone ? (
                            <Text style={styles.errorText}>
                              {errors.ownerPhone}
                            </Text>
                          ) : null}
                        </View>
                      </>
                    ) : ownerStep === 1 ? (
                      <>
                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>Store Name</Text>
                          <View
                            style={[
                              styles.inputShell,
                              errors.storeName && styles.inputShellError,
                            ]}
                          >
                            <Ionicons
                              color="#64748b"
                              name="storefront-outline"
                              size={18}
                            />
                            <TextInput
                              onBlur={() => handleFieldBlur("storeName")}
                              onChangeText={(value) =>
                                setFieldValue("storeName", value)
                              }
                              placeholder="Nana Grocery"
                              placeholderTextColor={theme.colors.mutedText}
                              selectionColor={theme.colors.accent}
                              style={styles.input}
                              value={storeName}
                            />
                          </View>
                          {errors.storeName ? (
                            <Text style={styles.errorText}>
                              {errors.storeName}
                            </Text>
                          ) : null}
                        </View>

                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>Category</Text>
                          <ScrollView
                            horizontal
                            contentContainerStyle={styles.chipRow}
                            showsHorizontalScrollIndicator={false}
                          >
                            {STORE_CATEGORY_OPTIONS.map((option) => {
                              const active = category === option;

                              return (
                                <TouchableOpacity
                                  key={option}
                                  activeOpacity={0.85}
                                  onPress={() =>
                                    setFieldValue("category", option)
                                  }
                                  style={[
                                    styles.chip,
                                    active && styles.chipActive,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.chipText,
                                      active && styles.chipTextActive,
                                    ]}
                                  >
                                    {option}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                          {errors.category ? (
                            <Text style={styles.errorText}>
                              {errors.category}
                            </Text>
                          ) : null}
                        </View>

                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>Store Phone</Text>
                          <View
                            style={[
                              styles.inputShell,
                              errors.storePhone && styles.inputShellError,
                            ]}
                          >
                            <Ionicons
                              color="#64748b"
                              name="call-outline"
                              size={18}
                            />
                            <TextInput
                              keyboardType="phone-pad"
                              onBlur={() => handleFieldBlur("storePhone")}
                              onChangeText={(value) =>
                                setFieldValue("storePhone", value)
                              }
                              placeholder="+1 555 987 6543"
                              placeholderTextColor={theme.colors.mutedText}
                              selectionColor={theme.colors.accent}
                              style={styles.input}
                              value={storePhone}
                            />
                          </View>
                          {errors.storePhone ? (
                            <Text style={styles.errorText}>
                              {errors.storePhone}
                            </Text>
                          ) : null}
                        </View>

                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>Country</Text>
                          <View
                            style={[
                              styles.inputShell,
                              errors.country && styles.inputShellError,
                            ]}
                          >
                            <Ionicons
                              color="#64748b"
                              name="earth-outline"
                              size={18}
                            />
                            <TextInput
                              onBlur={() => handleFieldBlur("country")}
                              onChangeText={(value) =>
                                setFieldValue("country", value)
                              }
                              placeholder="Nigeria"
                              placeholderTextColor={theme.colors.mutedText}
                              selectionColor={theme.colors.accent}
                              style={styles.input}
                              value={country}
                            />
                          </View>
                          {errors.country ? (
                            <Text style={styles.errorText}>
                              {errors.country}
                            </Text>
                          ) : null}
                        </View>

                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>State / City</Text>
                          <View
                            style={[
                              styles.inputShell,
                              errors.stateRegion && styles.inputShellError,
                            ]}
                          >
                            <Ionicons
                              color="#64748b"
                              name="location-outline"
                              size={18}
                            />
                            <TextInput
                              onBlur={() => handleFieldBlur("stateRegion")}
                              onChangeText={(value) =>
                                setFieldValue("stateRegion", value)
                              }
                              placeholder="California / San Francisco"
                              placeholderTextColor={theme.colors.mutedText}
                              selectionColor={theme.colors.accent}
                              style={styles.input}
                              value={stateRegion}
                            />
                          </View>
                          {errors.stateRegion ? (
                            <Text style={styles.errorText}>
                              {errors.stateRegion}
                            </Text>
                          ) : null}
                        </View>

                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>
                            Store Description
                          </Text>
                          <View
                            style={[
                              styles.textAreaShell,
                              errors.description && styles.inputShellError,
                            ]}
                          >
                            <TextInput
                              multiline
                              numberOfLines={4}
                              onBlur={() => handleFieldBlur("description")}
                              onChangeText={(value) =>
                                setFieldValue("description", value)
                              }
                              placeholder="Describe what your store sells and what makes it useful."
                              placeholderTextColor={theme.colors.mutedText}
                              selectionColor={theme.colors.accent}
                              style={styles.textArea}
                              textAlignVertical="top"
                              value={description}
                            />
                          </View>
                          {errors.description ? (
                            <Text style={styles.errorText}>
                              {errors.description}
                            </Text>
                          ) : null}
                        </View>

                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>Store Photos</Text>
                          <Text style={styles.helperText}>
                            The first image becomes your store header
                            background. Add up to 3 images.
                          </Text>
                          <View style={styles.storeImageGrid}>
                            {imageSlots.map((image, index) => (
                              <View
                                key={`signup-store-image:${index}`}
                                style={[
                                  styles.storeImageSlot,
                                  index === 0 && styles.storeImageSlotPrimary,
                                  imageSlots.length === 1 &&
                                    styles.storeImageSlotSingle,
                                  imageSlots.length === 2 &&
                                    index > 0 &&
                                    styles.storeImageSlotHalf,
                                ]}
                              >
                                {image ? (
                                  <Image
                                    resizeMode="cover"
                                    source={{ uri: image }}
                                    style={[
                                      styles.storeImagePreview,
                                      index === 0 &&
                                        styles.storeImagePreviewPrimary,
                                    ]}
                                  />
                                ) : (
                                  <View
                                    style={[
                                      styles.storeImagePlaceholder,
                                      index === 0 &&
                                        styles.storeImagePlaceholderPrimary,
                                    ]}
                                  >
                                    <Ionicons
                                      color="#94a3b8"
                                      name="image-outline"
                                      size={28}
                                    />
                                    <Text
                                      style={styles.storeImagePlaceholderText}
                                    >
                                      Add image
                                    </Text>
                                  </View>
                                )}

                                <View style={styles.storeImageActions}>
                                  <TouchableOpacity
                                    activeOpacity={0.85}
                                    disabled={isPickingImage}
                                    onPress={() =>
                                      void handlePickStoreImage(
                                        index,
                                        "library",
                                      )
                                    }
                                    style={styles.imageActionButton}
                                  >
                                    <Text style={styles.imageActionButtonText}>
                                      {editingImageIndex === index &&
                                      isPickingImage
                                        ? "Loading..."
                                        : image
                                          ? "Replace"
                                          : "Gallery"}
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    activeOpacity={0.85}
                                    disabled={isPickingImage}
                                    onPress={() =>
                                      void handlePickStoreImage(index, "camera")
                                    }
                                    style={styles.imageActionButton}
                                  >
                                    <Text style={styles.imageActionButtonText}>
                                      Camera
                                    </Text>
                                  </TouchableOpacity>
                                  {image ? (
                                    <TouchableOpacity
                                      activeOpacity={0.85}
                                      onPress={() =>
                                        handleRemoveStoreImage(index)
                                      }
                                      style={styles.imageActionButtonSecondary}
                                    >
                                      <Text
                                        style={
                                          styles.imageActionButtonSecondaryText
                                        }
                                      >
                                        Remove
                                      </Text>
                                    </TouchableOpacity>
                                  ) : null}
                                </View>
                              </View>
                            ))}
                          </View>
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={styles.noticeInline}>
                          <Text style={styles.noticeInlineTitle}>Location</Text>
                          <Text style={styles.noticeInlineText}>
                            {locationMessage}
                          </Text>
                        </View>
                        <Text style={styles.helperText}>
                          Tap to move the pin. The pin position is the final
                          saved store location.
                        </Text>

                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>
                            Search store location
                          </Text>
                          <View
                            style={[
                              styles.inputShell,
                              errors.address && styles.inputShellError,
                            ]}
                          >
                            <Ionicons
                              color="#64748b"
                              name="search-outline"
                              size={18}
                            />
                            <TextInput
                              autoCorrect={false}
                              onBlur={() => {
                                setTimeout(() => {
                                  setIsAddressInputFocused(false);
                                }, 120);
                                handleFieldBlur("address");
                              }}
                              onChangeText={(value) =>
                                setFieldValue("address", value)
                              }
                              onFocus={() => setIsAddressInputFocused(true)}
                              placeholder="Search store location"
                              placeholderTextColor={theme.colors.mutedText}
                              selectionColor={theme.colors.accent}
                              style={styles.input}
                              value={address}
                            />
                          </View>
                          {canShowAddressSuggestions ? (
                            <View style={styles.suggestionsCard}>
                              {isAddressSearching ? (
                                <Text style={styles.suggestionMetaText}>
                                  Searching nearby places...
                                </Text>
                              ) : null}

                              {!isAddressSearching &&
                              addressSearchState === "empty" ? (
                                <Text style={styles.suggestionMetaText}>
                                  No matching places found yet.
                                </Text>
                              ) : null}

                              {!isAddressSearching &&
                              addressSearchState === "error" ? (
                                <Text style={styles.suggestionMetaText}>
                                  {addressSearchErrorMessage}
                                </Text>
                              ) : null}

                              {addressSuggestions.map((suggestion) => (
                                <TouchableOpacity
                                  key={suggestion.id}
                                  activeOpacity={0.85}
                                  onPress={() =>
                                    void handleSelectAddressSuggestion(
                                      suggestion,
                                    )
                                  }
                                  style={styles.suggestionItem}
                                >
                                  <View style={styles.suggestionDot} />
                                  <View style={styles.suggestionContent}>
                                    <Text
                                      numberOfLines={1}
                                      style={styles.suggestionTitle}
                                    >
                                      {suggestion.title}
                                    </Text>
                                    {suggestion.subtitle ? (
                                      <Text
                                        numberOfLines={2}
                                        style={styles.suggestionSubtitle}
                                      >
                                        {suggestion.subtitle}
                                      </Text>
                                    ) : null}
                                  </View>
                                </TouchableOpacity>
                              ))}
                            </View>
                          ) : null}
                          {errors.address ? (
                            <Text style={styles.errorText}>
                              {errors.address}
                            </Text>
                          ) : null}
                          <Text style={styles.helperText}>
                            Search helps you find places quickly. Your final
                            store location still comes from the map pin you
                            confirm below.
                          </Text>
                        </View>

                        <TouchableOpacity
                          activeOpacity={0.85}
                          disabled={isUsingCurrentLocation}
                          onPress={() => void handleUseCurrentLocation()}
                          style={styles.secondaryButton}
                        >
                          <Text style={styles.secondaryButtonText}>
                            {isUsingCurrentLocation
                              ? "Getting current location..."
                              : "Use current location"}
                          </Text>
                        </TouchableOpacity>

                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>Place your pin</Text>
                          <StoreLocationPicker
                            address={address}
                            coordinates={locationCoordinates}
                            onChange={handleMapChange}
                            storeName={storeName}
                          />
                          {errors.location ? (
                            <Text style={styles.errorText}>
                              {errors.location}
                            </Text>
                          ) : null}
                        </View>

                        <TouchableOpacity
                          activeOpacity={0.85}
                          disabled={!locationCoordinates}
                          onPress={handleConfirmLocation}
                          style={[
                            styles.secondaryButton,
                            !locationCoordinates && styles.submitButtonDisabled,
                            isLocationConfirmed &&
                              styles.locationConfirmedButton,
                          ]}
                        >
                          <Text style={styles.secondaryButtonText}>
                            {isLocationConfirmed
                              ? "Location confirmed"
                              : "Confirm location"}
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                ) : null}

                {!selectedStorePlan ? (
                  <>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Name</Text>
                      <View
                        style={[
                          styles.inputShell,
                          errors.name && styles.inputShellError,
                        ]}
                      >
                        <Ionicons
                          color="#64748b"
                          name="person-outline"
                          size={18}
                        />
                        <TextInput
                          onBlur={() => handleFieldBlur("name")}
                          onChangeText={(value) => setFieldValue("name", value)}
                          placeholder="Enter your name"
                          placeholderTextColor={theme.colors.mutedText}
                          selectionColor={theme.colors.accent}
                          style={styles.input}
                          value={name}
                        />
                      </View>
                      {errors.name ? (
                        <Text style={styles.errorText}>{errors.name}</Text>
                      ) : null}
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Email</Text>
                      <View
                        style={[
                          styles.inputShell,
                          errors.email && styles.inputShellError,
                        ]}
                      >
                        <Ionicons
                          color="#64748b"
                          name="mail-outline"
                          size={18}
                        />
                        <TextInput
                          autoCapitalize="none"
                          keyboardType="email-address"
                          onBlur={() => handleFieldBlur("email")}
                          onChangeText={(value) =>
                            setFieldValue("email", value)
                          }
                          placeholder="Enter your email"
                          placeholderTextColor={theme.colors.mutedText}
                          selectionColor={theme.colors.accent}
                          style={styles.input}
                          value={email}
                        />
                      </View>
                      {errors.email ? (
                        <Text style={styles.errorText}>{errors.email}</Text>
                      ) : null}
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Password</Text>
                      <View
                        style={[
                          styles.inputShell,
                          errors.password && styles.inputShellError,
                        ]}
                      >
                        <Ionicons
                          color="#64748b"
                          name="lock-closed-outline"
                          size={18}
                        />
                        <TextInput
                          autoCapitalize="none"
                          onBlur={() => handleFieldBlur("password")}
                          onChangeText={(value) =>
                            setFieldValue("password", value)
                          }
                          placeholder="Enter your password"
                          placeholderTextColor={theme.colors.mutedText}
                          secureTextEntry={!showPassword}
                          selectionColor={theme.colors.accent}
                          style={styles.input}
                          value={password}
                        />
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => setShowPassword((current) => !current)}
                        >
                          <Ionicons
                            color="#94a3b8"
                            name={
                              showPassword ? "eye-off-outline" : "eye-outline"
                            }
                            size={18}
                          />
                        </TouchableOpacity>
                      </View>
                      {errors.password ? (
                        <Text style={styles.errorText}>{errors.password}</Text>
                      ) : null}
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Confirm Password</Text>
                      <View
                        style={[
                          styles.inputShell,
                          errors.confirmPassword && styles.inputShellError,
                        ]}
                      >
                        <Ionicons
                          color="#64748b"
                          name="shield-checkmark-outline"
                          size={18}
                        />
                        <TextInput
                          autoCapitalize="none"
                          onBlur={() => handleFieldBlur("confirmPassword")}
                          onChangeText={(value) =>
                            setFieldValue("confirmPassword", value)
                          }
                          placeholder="Confirm your password"
                          placeholderTextColor={theme.colors.mutedText}
                          secureTextEntry={!showPassword}
                          selectionColor={theme.colors.accent}
                          style={styles.input}
                          value={confirmPassword}
                        />
                      </View>
                      {errors.confirmPassword ? (
                        <Text style={styles.errorText}>
                          {errors.confirmPassword}
                        </Text>
                      ) : null}
                    </View>
                  </>
                ) : null}

                {notice ? (
                  <View
                    style={[
                      styles.notice,
                      notice.type === "error"
                        ? styles.noticeError
                        : styles.noticeSuccess,
                    ]}
                  >
                    <Text style={styles.noticeText}>{notice.text}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={primaryActionDisabled}
                  onPress={
                    selectedStorePlan
                      ? ownerStep < 2
                        ? handleContinueOwnerSignup
                        : handleSubmit
                      : handleSubmit
                  }
                  style={[
                    styles.submitButton,
                    primaryActionDisabled && styles.submitButtonDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.submitButtonText,
                      primaryActionDisabled && styles.submitButtonTextDisabled,
                    ]}
                  >
                    {isSubmitting
                      ? "Creating account..."
                      : selectedStorePlan
                        ? ownerStep < 2
                          ? "Continue"
                          : "Finish store setup"
                        : "Create account"}
                  </Text>
                </TouchableOpacity>

                {selectedStorePlan && ownerStep > 0 ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() =>
                      setOwnerStep((current) =>
                        current > 0 ? ((current - 1) as OwnerSignupStep) : 0,
                      )
                    }
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {ownerStep === 1
                        ? "Back to owner account"
                        : "Back to store details"}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {!selectedStorePlan ? (
              <Text style={styles.footerText}>
                Already have an account?{" "}
                <Text
                  onPress={() => router.push("/login")}
                  style={styles.footerLink}
                >
                  Log in
                </Text>
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const BORDER = "rgba(255,255,255,0.10)";

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  page: {
    flex: 1,
    justifyContent: "center",
    gap: 22,
    position: "relative",
  },
  heroGlowPrimary: {
    position: "absolute",
    top: 20,
    left: -48,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(56, 189, 248, 0.10)",
  },
  heroGlowSecondary: {
    position: "absolute",
    right: -30,
    bottom: 90,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "rgba(125, 211, 252, 0.08)",
  },
  header: {
    alignItems: "center",
    gap: 12,
  },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  brandGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(56,189,248,0.18)",
    borderRadius: 22,
  },
  brandMarkText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  brandTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  brandSubtitle: {
    color: theme.colors.mutedText,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  formCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    padding: 20,
  },
  introBlock: {
    marginBottom: 22,
  },
  introEyebrow: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  introText: {
    marginTop: 10,
    color: "#e2e8f0",
    fontSize: 15,
    lineHeight: 22,
  },
  resumeText: {
    marginTop: 10,
    color: "#bae6fd",
    fontSize: 12,
    fontWeight: "600",
  },
  formStack: {
    gap: 16,
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  sectionCardTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  sectionCardSubtitle: {
    marginTop: 4,
    color: theme.colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  stepPanel: {
    gap: 16,
  },
  stepCounter: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  stepRow: {
    gap: 10,
  },
  stepCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stepCardActive: {
    borderColor: "rgba(125,211,252,0.35)",
    backgroundColor: "rgba(56,189,248,0.12)",
  },
  stepCardComplete: {
    borderColor: "rgba(52,211,153,0.3)",
    backgroundColor: "rgba(16,185,129,0.10)",
  },
  stepTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  stepTitleActive: {
    color: "#e0f2fe",
  },
  stepDescription: {
    marginTop: 3,
    color: theme.colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  stepDescriptionActive: {
    color: "#cbd5e1",
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(2,6,23,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputShellError: {
    borderColor: "rgba(244,63,94,0.4)",
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    paddingVertical: 0,
  },
  textAreaShell: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(2,6,23,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textArea: {
    minHeight: 72,
    color: theme.colors.text,
    fontSize: 15,
  },
  chipRow: {
    gap: 10,
    paddingRight: 4,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipActive: {
    borderColor: "rgba(125,211,252,0.38)",
    backgroundColor: "rgba(56,189,248,0.16)",
  },
  chipText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#e0f2fe",
  },
  errorText: {
    color: "#fda4af",
    fontSize: 12,
  },
  helperText: {
    color: theme.colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  suggestionsCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(2,6,23,0.92)",
    overflow: "hidden",
  },
  suggestionMetaText: {
    color: theme.colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  suggestionItem: {
    alignItems: "flex-start",
    borderTopColor: "rgba(255,255,255,0.06)",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  suggestionDot: {
    backgroundColor: "#60a5fa",
    borderRadius: 999,
    height: 10,
    marginTop: 6,
    shadowColor: "rgba(96,165,250,0.7)",
    shadowOpacity: 0.6,
    shadowRadius: 12,
    width: 10,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  suggestionSubtitle: {
    color: theme.colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  notice: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeError: {
    borderColor: "rgba(244,63,94,0.2)",
    backgroundColor: "rgba(244,63,94,0.12)",
  },
  noticeSuccess: {
    borderColor: "rgba(52,211,153,0.2)",
    backgroundColor: "rgba(52,211,153,0.12)",
  },
  noticeText: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  noticeInline: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(125,211,252,0.14)",
    backgroundColor: "rgba(56,189,248,0.10)",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noticeInlineTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  noticeInlineText: {
    color: "#d7e4f2",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  storeImageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 10,
  },
  storeImageSlot: {
    width: "48%",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    backgroundColor: "rgba(15,23,42,0.92)",
  },
  storeImageSlotPrimary: {
    width: "100%",
  },
  storeImageSlotSingle: {
    width: "100%",
  },
  storeImageSlotHalf: {
    width: "48%",
  },
  storeImagePreview: {
    width: "100%",
    height: 154,
    backgroundColor: "#0f172a",
  },
  storeImagePreviewPrimary: {
    height: 208,
  },
  storeImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 154,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  storeImagePlaceholderPrimary: {
    height: 208,
  },
  storeImagePlaceholderText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "700",
  },
  storeImageActions: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  imageActionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "rgba(56, 189, 248, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.22)",
    paddingHorizontal: 10,
  },
  imageActionButtonText: {
    color: "#e0f2fe",
    fontSize: 13,
    fontWeight: "800",
  },
  imageActionButtonSecondary: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 12,
  },
  imageActionButtonSecondaryText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  submitButton: {
    borderRadius: 18,
    backgroundColor: "#fff",
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  submitButtonText: {
    color: "#020617",
    fontSize: 15,
    fontWeight: "700",
  },
  submitButtonTextDisabled: {
    color: "#cbd5e1",
  },
  secondaryButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  disabledTextArea: {
    color: "#d7e4f2",
    opacity: 0.88,
  },
  locationConfirmedButton: {
    borderColor: "rgba(52,211,153,0.22)",
    backgroundColor: "rgba(52,211,153,0.12)",
  },
  footerText: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
  },
  footerLink: {
    color: "#dbeafe",
    fontWeight: "700",
  },
});
