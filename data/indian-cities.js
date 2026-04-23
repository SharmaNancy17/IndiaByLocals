// Comprehensive data of Indian states and major cities
const indianLocations = {
    states: [
        {
            name: "Andhra Pradesh",
            capital: "Amaravati",
            cities: ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Tirupati", "Rajahmundry", "Kakinada"]
        },
        {
            name: "Arunachal Pradesh",
            capital: "Itanagar",
            cities: ["Itanagar", "Naharlagun", "Pasighat", "Tawang", "Ziro"]
        },
        {
            name: "Assam",
            capital: "Dispur",
            cities: ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tezpur", "Tinsukia"]
        },
        {
            name: "Bihar",
            capital: "Patna",
            cities: ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga", "Purnia", "Bihar Sharif"]
        },
        {
            name: "Chhattisgarh",
            capital: "Raipur",
            cities: ["Raipur", "Bhilai", "Bilaspur", "Korba", "Durg", "Rajnandgaon"]
        },
        {
            name: "Goa",
            capital: "Panaji",
            cities: ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda"]
        },
        {
            name: "Gujarat",
            capital: "Gandhinagar",
            cities: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Junagadh", "Gandhinagar", "Anand"]
        },
        {
            name: "Haryana",
            capital: "Chandigarh",
            cities: ["Faridabad", "Gurgaon", "Panipat", "Ambala", "Yamunanagar", "Rohtak", "Hisar", "Karnal"]
        },
        {
            name: "Himachal Pradesh",
            capital: "Shimla",
            cities: ["Shimla", "Manali", "Dharamshala", "Solan", "Mandi", "Kullu", "Palampur"]
        },
        {
            name: "Jharkhand",
            capital: "Ranchi",
            cities: ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar", "Hazaribagh"]
        },
        {
            name: "Karnataka",
            capital: "Bengaluru",
            cities: ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi", "Belagavi", "Davanagere", "Ballari", "Vijayapura", "Shivamogga"]
        },
        {
            name: "Kerala",
            capital: "Thiruvananthapuram",
            cities: ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam", "Palakkad", "Alappuzha", "Kannur"]
        },
        {
            name: "Madhya Pradesh",
            capital: "Bhopal",
            cities: ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas", "Satna", "Ratlam"]
        },
        {
            name: "Maharashtra",
            capital: "Mumbai",
            cities: ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Aurangabad", "Solapur", "Kolhapur", "Amravati", "Navi Mumbai"]
        },
        {
            name: "Manipur",
            capital: "Imphal",
            cities: ["Imphal", "Thoubal", "Bishnupur", "Churachandpur"]
        },
        {
            name: "Meghalaya",
            capital: "Shillong",
            cities: ["Shillong", "Tura", "Nongstoin", "Jowai"]
        },
        {
            name: "Mizoram",
            capital: "Aizawl",
            cities: ["Aizawl", "Lunglei", "Champhai", "Serchhip"]
        },
        {
            name: "Nagaland",
            capital: "Kohima",
            cities: ["Kohima", "Dimapur", "Mokokchung", "Tuensang"]
        },
        {
            name: "Odisha",
            capital: "Bhubaneswar",
            cities: ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri", "Balasore"]
        },
        {
            name: "Punjab",
            capital: "Chandigarh",
            cities: ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Pathankot"]
        },
        {
            name: "Rajasthan",
            capital: "Jaipur",
            cities: ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bikaner", "Alwar", "Bharatpur", "Sikar"]
        },
        {
            name: "Sikkim",
            capital: "Gangtok",
            cities: ["Gangtok", "Namchi", "Gyalshing", "Mangan"]
        },
        {
            name: "Tamil Nadu",
            capital: "Chennai",
            cities: ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Tiruppur", "Erode", "Vellore"]
        },
        {
            name: "Telangana",
            capital: "Hyderabad",
            cities: ["Hyderabad", "Warangal", "Nizamabad", "Khammam", "Karimnagar", "Ramagundam"]
        },
        {
            name: "Tripura",
            capital: "Agartala",
            cities: ["Agartala", "Udaipur", "Dharmanagar", "Kailashahar"]
        },
        {
            name: "Uttar Pradesh",
            capital: "Lucknow",
            cities: ["Lucknow", "Kanpur", "Ghaziabad", "Agra", "Varanasi", "Meerut", "Allahabad", "Bareilly", "Aligarh", "Moradabad", "Noida"]
        },
        {
            name: "Uttarakhand",
            capital: "Dehradun",
            cities: ["Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rudrapur", "Rishikesh", "Nainital"]
        },
        {
            name: "West Bengal",
            capital: "Kolkata",
            cities: ["Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri", "Bardhaman", "Malda", "Darjeeling"]
        }
    ],
    unionTerritories: [
        {
            name: "Andaman and Nicobar Islands",
            capital: "Port Blair",
            cities: ["Port Blair"]
        },
        {
            name: "Chandigarh",
            capital: "Chandigarh",
            cities: ["Chandigarh"]
        },
        {
            name: "Dadra and Nagar Haveli and Daman and Diu",
            capital: "Daman",
            cities: ["Daman", "Diu", "Silvassa"]
        },
        {
            name: "Delhi",
            capital: "New Delhi",
            cities: ["New Delhi", "Delhi"]
        },
        {
            name: "Jammu and Kashmir",
            capital: "Srinagar (Summer), Jammu (Winter)",
            cities: ["Srinagar", "Jammu", "Anantnag", "Baramulla", "Udhampur"]
        },
        {
            name: "Ladakh",
            capital: "Leh",
            cities: ["Leh", "Kargil"]
        },
        {
            name: "Lakshadweep",
            capital: "Kavaratti",
            cities: ["Kavaratti"]
        },
        {
            name: "Puducherry",
            capital: "Puducherry",
            cities: ["Puducherry", "Karaikal", "Mahe", "Yanam"]
        }
    ]
};

// Flatten all locations for easy searching
function getAllLocations() {
    const locations = [];
    
    // Add states and their cities
    indianLocations.states.forEach(state => {
        locations.push({
            name: state.name,
            type: 'State',
            capital: state.capital,
            searchName: state.name.toLowerCase()
        });
        
        state.cities.forEach(city => {
            locations.push({
                name: city,
                type: 'City',
                state: state.name,
                searchName: city.toLowerCase()
            });
        });
    });
    
    // Add union territories and their cities
    indianLocations.unionTerritories.forEach(ut => {
        locations.push({
            name: ut.name,
            type: 'Union Territory',
            capital: ut.capital,
            searchName: ut.name.toLowerCase()
        });
        
        ut.cities.forEach(city => {
            locations.push({
                name: city,
                type: 'City',
                state: ut.name,
                searchName: city.toLowerCase()
            });
        });
    });
    
    return locations;
}

// Made with Bob
