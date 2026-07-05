import { useState, useEffect, useCallback } from 'react';
import { Hospital, Pill, MapPin, Phone, Search, Crosshair } from 'lucide-react';
import { getNearbyHospitals, getNearbyPharmacies } from '../services/locationService.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useLanguage } from '../context/LanguageContext.jsx';

const CareNearMe = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('hospitals');
  const [hospitals, setHospitals] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [loadedTabs, setLoadedTabs] = useState({ hospitals: false, pharmacies: false });

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(t('care.geoUnsupported'));
      setUserLocation({ lat: 28.6139, lng: 77.2090 });
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLoadedTabs({ hospitals: false, pharmacies: false });
        setLocationError('');
      },
      () => {
        setLocationError(t('care.geoDenied'));
        setUserLocation({ lat: 28.6139, lng: 77.2090 });
        setLoadedTabs({ hospitals: false, pharmacies: false });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    getUserLocation();
  }, []);

  const fetchData = useCallback(async (tab = activeTab, { force = false } = {}) => {
    if (!userLocation) return;
    if (!force && loadedTabs[tab]) return;

    setLoading(true);
    setError('');
    try {
      const { lat, lng } = userLocation;

      if (tab === 'hospitals') {
        const hospitalsRes = await getNearbyHospitals(lat, lng);
        const data = Array.isArray(hospitalsRes.data) ? hospitalsRes.data : [];
        if (hospitalsRes.success) setHospitals(data);
        if (!data.length) setError(t('care.noHospitals'));
      } else {
        const pharmaciesRes = await getNearbyPharmacies(lat, lng);
        const data = Array.isArray(pharmaciesRes.data) ? pharmaciesRes.data : [];
        if (pharmaciesRes.success) setPharmacies(data);
        if (!data.length) setError(t('care.noPharmacies'));
      }

      setLoadedTabs((prev) => ({ ...prev, [tab]: true }));
    } catch (err) {
      if (err.code === 'ERR_NETWORK' || err.message?.includes('ERR_CONNECTION_REFUSED')) {
        setError(t('care.serverError'));
      } else {
        setError(err.response?.data?.error || t('care.networkError'));
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadedTabs, userLocation]);

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab, fetchData]);

  const handleGetDirections = (coordinates) => {
    if (coordinates?.lat && coordinates?.lng) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${coordinates.lat},${coordinates.lng}`,
        '_blank'
      );
    }
  };

  const list = activeTab === 'hospitals' ? hospitals : pharmacies;

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <div className="text-center mb-10 space-y-3">
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[#0f1f2e] tracking-tight">
          {t('care.title')}
        </h1>
        <p className="text-[#3e4c5b] max-w-2xl mx-auto">
          {t('care.subtitle')}
        </p>
      </div>

      <ErrorMessage message={error} onDismiss={() => setError('')} />

      {locationError && (
        <div className="bg-[#fef3c7]/60 border border-[#fde68a] rounded-2xl px-5 py-4 mb-6 text-sm text-[#7c5210]">
          {locationError}
        </div>
      )}

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-[#0f1f2e]">{t('care.yourLocation')}</h3>
            <p className="text-xs text-[#7b8593] mt-1 font-mono">
              {userLocation
                ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`
                : t('care.locating')}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 w-full"
              onClick={getUserLocation}
              disabled={loading}
            >
              <Crosshair size={14} /> {t('care.relocate')}
            </Button>
          </Card>

          <Card className="p-2">
              <button
                onClick={() => setActiveTab('hospitals')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'hospitals'
                  ? 'bg-[#0f766e] text-white'
                  : 'text-[#3e4c5b] hover:bg-[#f0eee6]'
              }`}
            >
              <Hospital size={18} /> {t('care.hospitals')}
            </button>
              <button
                onClick={() => setActiveTab('pharmacies')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors mt-1 ${
                activeTab === 'pharmacies'
                  ? 'bg-[#0f766e] text-white'
                  : 'text-[#3e4c5b] hover:bg-[#f0eee6]'
              }`}
            >
              <Pill size={18} /> {t('care.pharmacies')}
            </button>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-3">
          {loading ? (
            <Card className="p-16 flex flex-col items-center justify-center min-h-[400px]">
              <LoadingSpinner size="lg" />
              <p className="mt-6 text-sm text-[#7b8593]">{t('care.lookingAround')}</p>
            </Card>
          ) : list.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-4 animate-slide-up">
              {list.map((place) => (
                <Card
                  key={place.id || `${place.coordinates?.lat}-${place.name}`}
                  hover
                  className="p-5 flex flex-col gap-4"
                >
                  <div className="flex justify-between items-start gap-3">
                    <h3 className="font-display text-lg font-semibold text-[#0f1f2e] leading-tight">
                      {place.name}
                    </h3>
                    <span className="bg-[#d6f1ec] text-[#0f766e] px-2.5 py-1 rounded-full text-xs font-semibold shrink-0">
                      {place.distance}
                    </span>
                  </div>

                  <p className="text-sm text-[#3e4c5b] flex items-start gap-2 leading-relaxed">
                    <MapPin size={14} className="mt-0.5 shrink-0 text-[#7b8593]" />
                    <span>{place.address}</span>
                  </p>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {place.phone && place.phone !== 'Not available' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#f0eee6] text-[#3e4c5b] rounded-full">
                        <Phone size={11} /> {place.phone}
                      </span>
                    )}
                    {place.open24Hours && (
                      <span className="inline-flex items-center px-2.5 py-1 bg-[#dcfce7] text-[#166534] rounded-full font-medium">
                        {t('care.open24h')}
                      </span>
                    )}
                    {place.specialties?.slice(0, 2).map((s, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2.5 py-1 bg-white border border-[#d4cfbf] text-[#3e4c5b] rounded-full"
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                  <Button
                    onClick={() => handleGetDirections(place.coordinates)}
                    className="w-full mt-auto"
                    size="sm"
                  >
                    {t('care.getDirections')}
                  </Button>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-16 text-center">
              <Search size={40} className="mx-auto text-[#d4cfbf]" />
              <h3 className="mt-4 font-display text-xl font-semibold text-[#0f1f2e]">
                {t('care.nothingFound')}
              </h3>
              <p className="mt-2 text-sm text-[#7b8593]">
                {t('care.nothingFoundHint')}
              </p>
              <Button variant="secondary" className="mt-6" onClick={() => fetchData(activeTab, { force: true })}>
                {t('care.tryAgain')}
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default CareNearMe;
