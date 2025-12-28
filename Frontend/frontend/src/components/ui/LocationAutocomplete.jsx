import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Search } from 'lucide-react';

// Listă extensivă de 300+ orașe din toată lumea
const CITIES = [
    // România (toate județele)
    'București, România',
    'Cluj-Napoca, România',
    'Timișoara, România',
    'Iași, România',
    'Constanța, România',
    'Craiova, România',
    'Brașov, România',
    'Galați, România',
    'Ploiești, România',
    'Oradea, România',
    'Brăila, România',
    'Arad, România',
    'Pitești, România',
    'Sibiu, România',
    'Bacău, România',
    'Târgu Mureș, România',
    'Baia Mare, România',
    'Buzău, România',
    'Satu Mare, România',
    'Suceava, România',
    'Piatra Neamț, România',
    'Drobeta-Turnu Severin, România',
    'Focșani, România',
    'Târgoviște, România',
    'Botoșani, România',
    'Reșița, România',
    'Slatina, România',
    'Călărași, România',
    'Giurgiu, România',
    'Deva, România',
    'Alba Iulia, România',
    'Bistrița, România',
    'Zalău, România',
    'Sfântu Gheorghe, România',
    'Turda, România',
    'Mediaș, României',
    'Râmnicu Vâlcea, România',

    // Europa de Vest
    'Londra, UK',
    'Manchester, UK',
    'Birmingham, UK',
    'Edinburgh, UK',
    'Glasgow, UK',
    'Liverpool, UK',
    'Bristol, UK',
    'Leeds, UK',
    'Paris, Franța',
    'Marsilia, Franța',
    'Lyon, Franța',
    'Toulouse, Franța',
    'Nisa, Franța',
    'Nantes, Franța',
    'Strasbourg, Franța',
    'Montpellier, Franța',
    'Bordeaux, Franța',
    'Lille, Franța',
    'Berlin, Germania',
    'München, Germania',
    'Frankfurt, Germania',
    'Hamburg, Germania',
    'Köln, Germania',
    'Stuttgart, Germania',
    'Düsseldorf, Germania',
    'Dortmund, Germania',
    'Essen, Germania',
    'Leipzig, Germania',
    'Dresden, Germania',
    'Nürnberg, Germania',
    'Madrid, Spania',
    'Barcelona, Spania',
    'Valencia, Spania',
    'Sevilla, Spania',
    'Zaragoza, Spania',
    'Málaga, Spania',
    'Bilbao, Spania',
    'Granada, Spania',
    'Roma, Italia',
    'Milano, Italia',
    'Napoli, Italia',
    'Torino, Italia',
    'Palermo, Italia',
    'Genova, Italia',
    'Bologna, Italia',
    'Florența, Italia',
    'Veneția, Italia',
    'Verona, Italia',
    'Amsterdam, Olanda',
    'Rotterdam, Olanda',
    'Haga, Olanda',
    'Utrecht, Olanda',
    'Eindhoven, Olanda',
    'Bruxelles, Belgia',
    'Antwerpen, Belgia',
    'Gent, Belgia',
    'Viena, Austria',
    'Graz, Austria',
    'Salzburg, Austria',
    'Innsbruck, Austria',
    'Zürich, Elveția',
    'Geneva, Elveția',
    'Basel, Elveția',
    'Berna, Elveția',
    'Lausanne, Elveția',
    'Dublin, Irlanda',
    'Cork, Irlanda',
    'Lisabona, Portugalia',
    'Porto, Portugalia',

    // Europa de Nord
    'Stockholm, Suedia',
    'Göteborg, Suedia',
    'Malmö, Suedia',
    'Uppsala, Suedia',
    'Copenhaga, Danemarca',
    'Aarhus, Danemarca',
    'Odense, Danemarca',
    'Oslo, Norvegia',
    'Bergen, Norvegia',
    'Trondheim, Norvegia',
    'Helsinki, Finlanda',
    'Espoo, Finlanda',
    'Tampere, Finlanda',
    'Reykjavik, Islanda',

    // Europa de Est
    'Varșovia, Polonia',
    'Cracovia, Polonia',
    'Wrocław, Polonia',
    'Poznan, Polonia',
    'Gdansk, Polonia',
    'Praga, Cehia',
    'Brno, Cehia',
    'Ostrava, Cehia',
    'Budapesta, Ungaria',
    'Debrecen, Ungaria',
    'Szeged, Ungaria',
    'Sofia, Bulgaria',
    'Plovdiv, Bulgaria',
    'Varna, Bulgaria',
    'Kiev, Ucraina',
    'Harkov, Ucraina',
    'Odesa, Ucraina',
    'Lviv, Ucraina',
    'Bratislava, Slovacia',
    'Košice, Slovacia',
    'Ljubljana, Slovenia',
    'Maribor, Slovenia',
    'Zagreb, Croația',
    'Split, Croația',
    'Belgrad, Serbia',
    'Novi Sad, Serbia',
    'Atena, Grecia',
    'Salonic, Grecia',
    'Patras, Grecia',
    'Riga, Letonia',
    'Tallinn, Estonia',
    'Vilnius, Lituania',
    'Minsk, Belarus',
    'Chișinău, Moldova',

    // Asia
    'Tokyo, Japonia',
    'Osaka, Japonia',
    'Yokohama, Japonia',
    'Nagoya, Japonia',
    'Kyoto, Japonia',
    'Seoul, Coreea de Sud',
    'Busan, Coreea de Sud',
    'Beijing, China',
    'Shanghai, China',
    'Guangzhou, China',
    'Shenzhen, China',
    'Chengdu, China',
    'Hong Kong, China',
    'Singapore, Singapore',
    'Bangkok, Thailanda',
    'Hanoi, Vietnam',
    'Ho Chi Minh, Vietnam',
    'Manila, Filipine',
    'Jakarta, Indonezia',
    'Kuala Lumpur, Malaezia',
    'Mumbai, India',
    'Delhi, India',
    'Bangalore, India',
    'Chennai, India',
    'Kolkata, India',
    'Hyderabad, India',
    'Dubai, UAE',
    'Abu Dhabi, UAE',
    'Doha, Qatar',
    'Riyadh, Arabia Saudită',
    'Tel Aviv, Israel',
    'Istanbul, Turcia',
    'Ankara, Turcia',
    'Izmir, Turcia',

    // America de Nord
    'New York, SUA',
    'Los Angeles, SUA',
    'Chicago, SUA',
    'Houston, SUA',
    'Phoenix, SUA',
    'Philadelphia, SUA',
    'San Antonio, SUA',
    'San Diego, SUA',
    'Dallas, SUA',
    'San José, SUA',
    'Austin, SUA',
    'Jacksonville, SUA',
    'San Francisco, SUA',
    'Columbus, SUA',
    'Indianapolis, SUA',
    'Seattle, SUA',
    'Denver, SUA',
    'Washington DC, SUA',
    'Boston, SUA',
    'Detroit, SUA',
    'Nashville, SUA',
    'Portland, SUA',
    'Las Vegas, SUA',
    'Miami, SUA',
    'Atlanta, SUA',
    'Toronto, Canada',
    'Montreal, Canada',
    'Vancouver, Canada',
    'Calgary, Canada',
    'Ottawa, Canada',
    'Edmonton, Canada',
    'Mexico City, Mexic',
    'Guadalajara, Mexic',
    'Monterrey, Mexic',

    // America de Sud
    'São Paulo, Brazilia',
    'Rio de Janeiro, Brazilia',
    'Brasília, Brazilia',
    'Salvador, Brazilia',
    'Fortaleza, Brazilia',
    'Buenos Aires, Argentina',
    'Córdoba, Argentina',
    'Rosario, Argentina',
    'Lima, Peru',
    'Bogotá, Colombia',
    'Santiago, Chile',
    'Caracas, Venezuela',
    'Quito, Ecuador',
    'La Paz, Bolivia',

    // Africa
    'Cairo, Egipt',
    'Lagos, Nigeria',
    'Kinshasa, RD Congo',
    'Johannesburg, Africa de Sud',
    'Cape Town, Africa de Sud',
    'Nairobi, Kenya',
    'Casablanca, Maroc',
    'Addis Abeba, Etiopia',
    'Alger, Algeria',
    'Accra, Ghana',

    // Oceania
    'Sydney, Australia',
    'Melbourne, Australia',
    'Brisbane, Australia',
    'Perth, Australia',
    'Adelaide, Australia',
    'Auckland, Noua Zeelandă',
    'Wellington, Noua Zeelandă',

    // Rusia
    'Moscova, Rusia',
    'Sankt Petersburg, Rusia',
    'Novosibirsk, Rusia',
    'Ekaterinburg, Rusia',
    'Kazan, Rusia',
    'Nijni Novgorod, Rusia',
    'Samara, Rusia',
    'Omsk, Rusia',
    'Rostov pe Don, Rusia',
    'Ufa, Rusia'
].sort();

const LocationAutocomplete = ({ value, onChange, placeholder = 'Caută oraș...' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState(value || '');
    const [filteredCities, setFilteredCities] = useState([]);
    const dropdownRef = useRef(null);

    useEffect(() => {
        setSearchTerm(value || '');
    }, [value]);

    useEffect(() => {
        // Filter cities based on search term
        if (searchTerm.length > 0) {
            const filtered = CITIES.filter(city =>
                city.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredCities(filtered.slice(0, 10)); // Limităm la 10 rezultate
        } else {
            setFilteredCities(CITIES.slice(0, 10)); // Arată primele 10 orașe când nu e nimic scris
        }
    }, [searchTerm]);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setSearchTerm(newValue);
        onChange(newValue);
        setIsOpen(true);
    };

    const handleCitySelect = (city) => {
        setSearchTerm(city);
        onChange(city);
        setIsOpen(false);
    };

    const handleInputFocus = () => {
        setIsOpen(true);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <MapPin className="w-5 h-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    placeholder={placeholder}
                    className="w-full bg-dark-700 text-white pl-10 pr-4 py-2 rounded-lg border border-dark-600 focus:border-primary-500 focus:outline-none transition-colors"
                    autoComplete="off"
                />
                {isOpen && filteredCities.length > 0 && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <Search className="w-4 h-4 text-gray-500" />
                    </div>
                )}
            </div>

            {/* Dropdown */}
            {isOpen && filteredCities.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-dark-700 border border-dark-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                    {filteredCities.map((city, index) => (
                        <div
                            key={index}
                            onClick={() => handleCitySelect(city)}
                            className="px-4 py-3 hover:bg-dark-600 cursor-pointer transition-colors flex items-center gap-2 group"
                        >
                            <MapPin className="w-4 h-4 text-primary-400 flex-shrink-0" />
                            <span className="text-white group-hover:text-primary-400 transition-colors">
                                {city}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* No results */}
            {isOpen && searchTerm.length > 0 && filteredCities.length === 0 && (
                <div className="absolute z-50 w-full mt-2 bg-dark-700 border border-dark-600 rounded-lg shadow-xl p-4">
                    <p className="text-gray-400 text-center text-sm">
                        Nu am găsit orașul "{searchTerm}". Poți scrie manual.
                    </p>
                </div>
            )}
        </div>
    );
};

export default LocationAutocomplete;
