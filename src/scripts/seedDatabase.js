import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, push, get, remove } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDvqMwKKt5Zd-wNb6UxJW5HRFmw6OJTyzw",
  authDomain: "esphanoian.firebaseapp.com",
  databaseURL: "https://esphanoian-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "esphanoian",
  storageBucket: "esphanoian.firebasestorage.app",
  messagingSenderId: "27228573774",
  appId: "1:27228573774:web:5739a0b52fc7c86670f31f",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const baseItems = [
  { name: "Coke", unit: "Lon" },
  { name: "Coke Zero", unit: "Lon" },
  { name: "Sprite", unit: "Lon" },
  { name: "Soda", unit: "Chai" },
  { name: "Water", unit: "Chai" },
  { name: "Tonic", unit: "Chai" },
  { name: "Ale", unit: "Chai" },
  { name: "Trúc Bạch", unit: "Chai" },
  { name: "Sài Gòn", unit: "Lon" },
  { name: "Autumn", unit: "Chai" },
  { name: "Double IPA", unit: "Chai" },
  { name: "36 Opera", unit: "Chai" },
  { name: "36 Drum", unit: "Chai" },
  { name: "Claude Val Trắng", unit: "Chai" },
  { name: "Claude Val Đỏ", unit: "Chai" },
  { name: "Paolini Pinot Trắng", unit: "Chai" },
  { name: "Paolini Đỏ", unit: "Chai" },
  { name: "Vinas Trắng", unit: "Chai" },
  { name: "Vinas Đỏ", unit: "Chai" },
  { name: "Jack Daniels", unit: "Chai" },
  { name: "Aperol", unit: "Chai" },
  { name: "Jim Beam", unit: "Chai" },
  { name: "Grenadine", unit: "Chai" },
  { name: "Malibu", unit: "Chai" },
  { name: "Captian Morgan Dark", unit: "Chai" },
  { name: "Barcardi", unit: "Chai" },
  { name: "Bailey", unit: "Chai" },
  { name: "Tanqueray", unit: "Chai" },
  { name: "Lady Triệu Mekong", unit: "Chai" },
  { name: "Lady Triệu Flower", unit: "Chai" },
  { name: "Sông Cái", unit: "Chai" },
  { name: "Dewars", unit: "Chai" },
  { name: "Chivas Regal", unit: "Chai" },
  { name: "Macallan 12", unit: "Chai" },
  { name: "Maker Mark", unit: "Chai" },
  { name: "Wild Turkey", unit: "Chai" },
  { name: "Gorden", unit: "Chai" },
  { name: "Bombay Sapphire", unit: "Chai" },
  { name: "Johnnie Walker", unit: "Chai" },
  { name: "Robusta", unit: "Kg" },
  { name: "Arabica", unit: "Kg" },
  { name: "Phin Đen", unit: "Cái" },
  { name: "Phin Đỏ", unit: "Cái" },
  { name: "Phin Xám", unit: "Cái" },
  { name: "Phin Vàng", unit: "Cái" },
  { name: "Phin Tím", unit: "Cái" },
  { name: "Phin Xanh", unit: "Cái" },
  { name: "Trà Olong", unit: "Kg" },
  { name: "Trà Đen", unit: "Kg" },
  { name: "Matcha", unit: "Kg" },
  { name: "Bột Cacao", unit: "Kg" },
  { name: "Đường Đỏ", unit: "Kg" },
  { name: "Đường Trắng", unit: "Kg" },
  { name: "Rum", unit: "Chai" },
  { name: "Caramel", unit: "Chai" },
  { name: "Cốt Dừa", unit: "Lon" },
  { name: "Mật Ong", unit: "Hũ" },
  { name: "Monin Dừa", unit: "Chai" },
  { name: "Sốt Choco", unit: "Chai" },
  { name: "Sữa Đặc", unit: "Lon" },
  { name: "Sữa Tươi", unit: "Hộp" },
  { name: "Sữa Oat", unit: "Hộp" },
  { name: "Trứng Gà", unit: "Quả" },
  { name: "Bánh Chuối", unit: "Cái" },
  { name: "Cheese Cake", unit: "Cái" },
  { name: "Carrot Cake", unit: "Cái" },
  { name: "Cookies", unit: "Cái" },
  { name: "Kẹo Lạc", unit: "Gói" },
  { name: "Kẹo Dồi", unit: "Gói" },
  { name: "Xoài", unit: "Kg" },
  { name: "Dứa", unit: "Quả" },
  { name: "Dâu Tây", unit: "Kg" },
  { name: "Cam", unit: "Quả" },
  { name: "Chanh Leo", unit: "Quả" },
  { name: "Chanh Xanh", unit: "Quả" },
  { name: "Chanh Vàng", unit: "Quả" },
  { name: "Chuối", unit: "Quả" },
  { name: "Dưa Hấu", unit: "Quả" },
  { name: "Bơ (Avo)", unit: "Quả" },
];

const seedData = async () => {
  // Wipe old /inventory and /items
  await set(ref(database, 'inventory'), null);
  await set(ref(database, 'items'), null);

  const itemsRef = ref(database, 'items');
  for (const item of baseItems) {
    const newRef = push(itemsRef);
    await set(newRef, { name: item.name, unit: item.unit });
  }

  console.log(`✅ Seeded ${baseItems.length} items to /items`);
  process.exit(0);
};

seedData();
