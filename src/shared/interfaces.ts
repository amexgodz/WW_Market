// Общий объект скина
export interface ISkin {
  id: string; // UUID
  name: string; // "Knife | Doppler"
  price: number; // Цена (строго number)
  rarity: 'Common' | 'Rare' | 'Legendary' | 'Ancient';
  wear: string; // "Factory New", "Field-Tested" и т.д.
  image: string; // URL или путь к локальному файлу
  category: string; // "Knives", "Rifles", "Gloves"
  tags: string[];
  reviews: IReview[];
}

export interface IReview {
  userLogin: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export type UserRole = 'user' | 'admin';

// Объект пользователя
export interface IUser {
  id: string;
  login: string;
  balance: number;
  inventory: ISkin[]; // Список купленных предметов
  role: UserRole;
}
