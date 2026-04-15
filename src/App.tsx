/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component } from 'react';
import { 
  Menu, X, ShoppingBag, User as UserIcon, LogIn, LogOut, 
  ChevronRight, ChevronLeft, Star, CheckCircle, ArrowRight,
  Heart, Zap, Sparkles, ShieldCheck, BookOpen, 
  PlayCircle, FileText, HelpCircle, Save, Settings,
  Dumbbell, Droplets, Coffee, Users, Package, Plus,
  Trash2, Edit, Power, PowerOff, Search, Filter, Share2,
  Instagram, Youtube, Facebook, Twitter, Linkedin, MessageCircle,
  Clock, UserCheck, AlertCircle, Moon, Sun, LayoutDashboard
} from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { Dashboard } from './components/admin/Dashboard';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  collection, 
  getDocs,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  originalPrice: string;
  imageUrl: string;
  salesUrl: string;
  category: string;
  benefits: string[];
  stock?: number;
  status?: 'active' | 'inactive' | 'deleted';
  createdAt?: string;
}

interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: 'Master Admin' | 'Admin' | 'Afiliado' | 'Parceiro' | 'member';
  status?: 'active' | 'inactive' | 'deleted';
  age?: number;
  gender?: string;
  height?: number;
  currentWeight?: number;
  healthGoal?: string;
  targetWeight?: number;
  lossPace?: string;
  activityLevel?: string;
  dietaryRestrictions?: string;
  skinType?: string;
  beautyConcerns?: string;
  bio?: string;
  points?: number;
  createdAt?: string;
}

interface Article {
  id: string;
  title: string;
  excerpt: string;
  content?: string;
  category: string;
  type: 'video' | 'article' | 'guide';
  imageUrl: string;
  status?: 'active' | 'inactive' | 'deleted';
  createdAt?: string;
  author?: string;
  readTime?: string;
}

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  link?: string;
  active: boolean;
  type: 'hero' | 'promo' | 'other';
}

interface AppConfig {
  id: string;
  whatsappNumber: string;
  whatsappMessage: string;
  updatedAt?: string;
}

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  icon: string;
  active: boolean;
}

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
}

// --- Constants ---
const PRODUCTS: Product[] = [
  {
    id: 'secaps-black-cha',
    name: 'Secaps Black Chá',
    description: 'Energia, leveza e foco no resultado! Chá misto solúvel com cúrcuma e psyllium. Ajuda na digestão, saciedade e disposição diária.',
    price: 'R$ 127,90',
    originalPrice: 'R$ 209,90',
    imageUrl: 'https://picsum.photos/seed/tea/600/600',
    salesUrl: 'https://pay.hest.com.br/e441281d-404b-49d0-b8d0-84219c9d1851',
    category: 'emagrecimento',
    benefits: ['Digestão leve', 'Saciedade prolongada', 'Disposição diária', 'Rende 30 porções']
  },
  {
    id: 'secaps-black-capsulas',
    name: 'Secaps Black em Cápsulas',
    description: 'O único tratamento emagrecedor que age na raiz do problema. Fórmula potente para resultados rápidos e duradouros.',
    price: 'R$ 124,70',
    originalPrice: 'R$ 197,90',
    imageUrl: 'https://picsum.photos/seed/capsules/600/600',
    salesUrl: 'https://pay.hest.com.br/6ec5743f-ddb1-4536-888f-e2e7b2ad8ef9',
    category: 'emagrecimento',
    benefits: ['Queima de gordura', 'Controle de apetite', 'Aprovado pela ANVISA', 'Resultados reais']
  },
  {
    id: 'quero-plus',
    name: 'QUERO+',
    description: 'Pó para preparo de bebida com goma xantana e feno-grego. Desenvolvido para estimular o bem-estar e o prazer feminino.',
    price: 'R$ 146,93',
    originalPrice: 'R$ 209,90',
    imageUrl: 'https://picsum.photos/seed/wellness/600/600',
    salesUrl: 'https://pay.hest.com.br/7643519a-938a-4ea9-b7b4-e22a78d8f271',
    category: 'saude',
    benefits: ['Bem-estar feminino', 'Lubrificação natural', 'Aumento da sensibilidade', 'Sabor frutas vermelhas']
  },
  {
    id: 'toop-cor',
    name: 'TOOP COR',
    description: 'Restaure a cor do seu cabelo desde a raiz! Devolve a cor original, retarda a queda e aumenta o volume.',
    price: 'R$ 137,90',
    originalPrice: 'R$ 197,00',
    imageUrl: 'https://picsum.photos/seed/hair/600/600',
    salesUrl: 'https://pay.hest.com.br/a9a46db2-9d3a-4a82-9c57-922d5ff5cf1d',
    category: 'beleza',
    benefits: ['Restaura cor natural', 'Fortalece os fios', 'Aumenta volume', 'Aparência rejuvenescida']
  },
  {
    id: 'kit-fitness-elite',
    name: 'Kit Fitness Elite',
    description: 'Conjunto completo de faixas de resistência e acessórios para treinar em casa com eficiência.',
    price: 'R$ 189,90',
    originalPrice: 'R$ 259,00',
    imageUrl: 'https://picsum.photos/seed/fitness-kit/600/600',
    salesUrl: 'https://secabucho.app.br/',
    category: 'fitness',
    benefits: ['Treino versátil', 'Material durável', 'Guia de exercícios incluso', 'Portátil']
  },
  {
    id: 'serum-glow-boost',
    name: 'Sérum Glow Boost',
    description: 'Vitamina C pura e ácido hialurônico para uma pele radiante e hidratada o dia todo.',
    price: 'R$ 97,50',
    originalPrice: 'R$ 145,00',
    imageUrl: 'https://picsum.photos/seed/serum/600/600',
    salesUrl: 'https://secabucho.app.br/',
    category: 'beleza',
    benefits: ['Antioxidante potente', 'Hidratação profunda', 'Uniformiza o tom', 'Toque seco']
  }
];

const ARTICLES: Article[] = [
  {
    id: '1',
    title: 'Como acelerar seu metabolismo naturalmente',
    excerpt: 'Descubra os segredos da nutrição para manter seu corpo queimando calorias o dia todo.',
    category: 'Emagrecimento',
    type: 'article',
    imageUrl: 'https://picsum.photos/seed/metabolism/800/400'
  },
  {
    id: '2',
    title: 'Rotina de cuidados para pele oleosa',
    excerpt: 'Passo a passo completo para controlar a oleosidade e prevenir a acne.',
    category: 'Beleza',
    type: 'guide',
    imageUrl: 'https://picsum.photos/seed/skincare/800/400'
  },
  {
    id: '3',
    title: 'Treino de 15 minutos para queimar gordura',
    excerpt: 'Uma rotina intensa de HIIT que você pode fazer em qualquer lugar.',
    category: 'Saúde',
    type: 'video',
    imageUrl: 'https://picsum.photos/seed/workout/800/400'
  }
];

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: "Qual destes ingredientes do Secaps Black ajuda na saciedade?",
    options: ["Cúrcuma", "Psyllium", "Cafeína", "Açúcar"],
    correctAnswer: 1
  },
  {
    id: 2,
    question: "Qual a melhor temperatura para lavar o rosto e evitar oleosidade?",
    options: ["Água pelando", "Água morna", "Água fria", "Não importa"],
    correctAnswer: 2
  },
  {
    id: 3,
    question: "Quantos litros de água são recomendados por dia para um adulto médio?",
    options: ["500ml", "1 litro", "Cerca de 2 a 3 litros", "5 litros"],
    correctAnswer: 2
  }
];

// --- Components ---

const AdminPanel = ({ user }: { user: UserProfile }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'products' | 'categories' | 'banners' | 'social' | 'articles' | 'settings'>('dashboard');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [editingBanner, setEditingBanner] = useState<Partial<Banner> | null>(null);
  const [editingSocialLink, setEditingSocialLink] = useState<Partial<SocialLink> | null>(null);
  const [editingArticle, setEditingArticle] = useState<Partial<Article> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false);
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const fetchUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const fetchProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const dbProductsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      const merged = [...dbProductsData, ...PRODUCTS].filter((p, index, self) => 
        index === self.findIndex((t) => t.id === p.id)
      );
      setProducts(merged.filter(p => p.status !== 'deleted'));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    const fetchCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const categoriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      if (categoriesData.length === 0) {
        // Seed default categories
        const defaults = [
          { name: 'Emagrecimento', slug: 'emagrecimento' },
          { name: 'Beleza', slug: 'beleza' },
          { name: 'Saúde', slug: 'saude' },
          { name: 'Fitness', slug: 'fitness' }
        ];
        defaults.forEach(async (cat) => {
          const id = doc(collection(db, 'categories')).id;
          await setDoc(doc(db, 'categories', id), { ...cat, id });
        });
      }
      setCategories(categoriesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    const fetchBanners = onSnapshot(collection(db, 'banners'), (snapshot) => {
      const bannersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
      if (bannersData.length === 0) {
        // Seed default hero banner
        const defaultHero = {
          title: 'Banner Principal Home',
          imageUrl: 'https://picsum.photos/seed/wellness-main/800/1000',
          active: true,
          type: 'hero'
        };
        const id = 'hero-main';
        setDoc(doc(db, 'banners', id), { ...defaultHero, id });
      }
      setBanners(bannersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'banners');
    });

    const fetchSocialLinks = onSnapshot(collection(db, 'social_links'), (snapshot) => {
      const socialData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SocialLink));
      if (socialData.length === 0) {
        const defaults = [
          { platform: 'Instagram', url: 'https://instagram.com', icon: 'Instagram', active: true },
          { platform: 'Facebook', url: 'https://facebook.com', icon: 'Facebook', active: true },
          { platform: 'WhatsApp', url: 'https://whatsapp.com', icon: 'MessageCircle', active: true },
          { platform: 'YouTube', url: 'https://youtube.com', icon: 'Youtube', active: true }
        ];
        defaults.forEach(async (link) => {
          const id = doc(collection(db, 'social_links')).id;
          await setDoc(doc(db, 'social_links', id), { ...link, id });
        });
      }
      setSocialLinks(socialData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'social_links');
    });

    const fetchArticles = onSnapshot(collection(db, 'articles'), (snapshot) => {
      const dbArticlesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Article));
      const merged = [...dbArticlesData, ...ARTICLES].filter((a, index, self) => 
        index === self.findIndex((t) => t.id === a.id)
      );
      setArticles(merged.filter(a => a.status !== 'deleted'));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'articles');
    });

    const fetchConfig = onSnapshot(doc(db, 'configs', 'app_settings'), (snapshot) => {
      if (snapshot.exists()) {
        setAppConfig({ id: snapshot.id, ...snapshot.data() } as AppConfig);
      } else {
        // Seed default config
        const defaultConfig = {
          whatsappNumber: '5511999999999',
          whatsappMessage: 'Olá! Gostaria de saber mais sobre o Secabucho.',
          updatedAt: new Date().toISOString()
        };
        setDoc(doc(db, 'configs', 'app_settings'), defaultConfig);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'configs/app_settings');
    });

    return () => {
      fetchUsers();
      fetchProducts();
      fetchCategories();
      fetchBanners();
      fetchSocialLinks();
      fetchArticles();
      fetchConfig();
    };
  }, []);

  const handleUpdateUser = async (uid: string, data: Partial<UserProfile>) => {
    try {
      await updateDoc(doc(db, 'users', uid), data);
      setEditingUser(null);
      setIsUserModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const uid = editingUser.uid || `manual_${Date.now()}`;
    try {
      await setDoc(doc(db, 'users', uid), {
        ...editingUser,
        uid,
        createdAt: new Date().toISOString(),
        status: 'active'
      });
      setIsUserModalOpen(false);
      setEditingUser(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${uid}`);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Usuário',
      message: 'Tem certeza que deseja excluir permanentemente este usuário? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', uid));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
        }
      }
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const productId = editingProduct.id || doc(collection(db, 'products')).id;
    try {
      const productData = {
        ...editingProduct,
        id: productId,
        benefits: editingProduct.benefits || [],
        createdAt: editingProduct.createdAt || new Date().toISOString(),
        status: editingProduct.status || 'active'
      };
      await setDoc(doc(db, 'products', productId), productData);
      setEditingProduct(null);
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `products/${productId}`);
    }
  };

  const handleUpdateProduct = async (product: Product, data: Partial<Product>) => {
    try {
      await setDoc(doc(db, 'products', product.id), { ...product, ...data }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${product.id}`);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Produto',
      message: 'Tem certeza que deseja excluir este produto permanentemente?',
      onConfirm: async () => {
        try {
          await setDoc(doc(db, 'products', product.id), { ...product, status: 'deleted' }, { merge: true });
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `products/${product.id}`);
        }
      }
    });
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    const id = editingCategory.id || doc(collection(db, 'categories')).id;
    try {
      await setDoc(doc(db, 'categories', id), { ...editingCategory, id });
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `categories/${id}`);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Categoria',
      message: 'Tem certeza que deseja excluir esta categoria?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'categories', id));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
        }
      }
    });
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;
    const id = editingBanner.id || doc(collection(db, 'banners')).id;
    try {
      await setDoc(doc(db, 'banners', id), { ...editingBanner, id });
      setIsBannerModalOpen(false);
      setEditingBanner(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `banners/${id}`);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Banner',
      message: 'Tem certeza que deseja excluir este banner?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'banners', id));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `banners/${id}`);
        }
      }
    });
  };

  const handleSaveSocialLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSocialLink) return;
    const id = editingSocialLink.id || doc(collection(db, 'social_links')).id;
    try {
      await setDoc(doc(db, 'social_links', id), { ...editingSocialLink, id });
      setIsSocialModalOpen(false);
      setEditingSocialLink(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `social_links/${id}`);
    }
  };

  const handleDeleteSocialLink = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Rede Social',
      message: 'Tem certeza que deseja excluir esta rede social?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'social_links', id));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `social_links/${id}`);
        }
      }
    });
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArticle) return;
    const id = editingArticle.id || doc(collection(db, 'articles')).id;
    try {
      const data = {
        ...editingArticle,
        id,
        status: editingArticle.status || 'active',
        createdAt: editingArticle.createdAt || new Date().toISOString()
      };
      await setDoc(doc(db, 'articles', id), data);
      setIsArticleModalOpen(false);
      setEditingArticle(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `articles/${id}`);
    }
  };

  const handleUpdateArticleStatus = async (article: Article, status: 'active' | 'inactive') => {
    try {
      await setDoc(doc(db, 'articles', article.id), { ...article, status }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `articles/${article.id}`);
    }
  };

  const handleDeleteArticle = async (article: Article) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Conteúdo',
      message: 'Tem certeza que deseja excluir este conteúdo permanentemente?',
      onConfirm: async () => {
        try {
          await setDoc(doc(db, 'articles', article.id), { ...article, status: 'deleted' }, { merge: true });
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `articles/${article.id}`);
        }
      }
    });
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appConfig) return;
    try {
      await setDoc(doc(db, 'configs', 'app_settings'), {
        ...appConfig,
        updatedAt: new Date().toISOString()
      });
      setNotification({ message: 'Configurações salvas com sucesso!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'configs/app_settings');
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredArticles = articles.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredBanners = banners.filter(b => 
    b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSocialLinks = socialLinks.filter(s => 
    s.platform.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex justify-center p-20"><Zap className="animate-spin text-brand-secondary" /></div>;

  return (
    <div className="pt-32 pb-32 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "fixed top-10 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3",
              notification.type === 'success' ? "bg-green-600 text-white" : "bg-red-600 text-white"
            )}
          >
            {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h2 className="text-4xl font-extrabold text-brand-tertiary mb-2">Painel Administrativo</h2>
          <p className="text-gray-500">Gestão completa de usuários, permissões e catálogo de produtos.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-2xl">
          <button 
            onClick={() => { setActiveTab('dashboard'); setSearchTerm(''); }}
            className={cn(
              "px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2",
              activeTab === 'dashboard' ? "bg-white text-brand-tertiary shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button 
            onClick={() => { setActiveTab('users'); setSearchTerm(''); }}
            className={cn(
              "px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2",
              activeTab === 'users' ? "bg-white text-brand-tertiary shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Users size={18} />
            Usuários
          </button>
          <button 
            onClick={() => { setActiveTab('products'); setSearchTerm(''); }}
            className={cn(
              "px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2",
              activeTab === 'products' ? "bg-white text-brand-tertiary shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Package size={18} />
            Produtos
          </button>
          <button 
            onClick={() => { setActiveTab('categories'); setSearchTerm(''); }}
            className={cn(
              "px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2",
              activeTab === 'categories' ? "bg-white text-brand-tertiary shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Filter size={18} />
            Categorias
          </button>
          <button 
            onClick={() => { setActiveTab('articles'); setSearchTerm(''); }}
            className={cn(
              "px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2",
              activeTab === 'articles' ? "bg-white text-brand-tertiary shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <BookOpen size={18} />
            Conteúdos
          </button>
          <button 
            onClick={() => { setActiveTab('banners'); setSearchTerm(''); }}
            className={cn(
              "px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2",
              activeTab === 'banners' ? "bg-white text-brand-tertiary shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Zap size={18} />
            Banners
          </button>
          <button 
            onClick={() => { setActiveTab('social'); setSearchTerm(''); }}
            className={cn(
              "px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2",
              activeTab === 'social' ? "bg-white text-brand-tertiary shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Share2 size={18} />
            Redes Sociais
          </button>
          <button 
            onClick={() => { setActiveTab('settings'); setSearchTerm(''); }}
            className={cn(
              "px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2",
              activeTab === 'settings' ? "bg-white text-brand-tertiary shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Settings size={18} />
            Configurações
          </button>
        </div>
      </div>

      <div className={cn("mb-8 flex flex-col md:flex-row gap-4 items-center justify-between", activeTab === 'dashboard' && "hidden")}>
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder={`Buscar ${
              activeTab === 'users' ? 'usuários' : 
              activeTab === 'products' ? 'produtos' : 
              activeTab === 'categories' ? 'categorias' : 
              activeTab === 'banners' ? 'banners' : 
              activeTab === 'articles' ? 'conteúdos' : 'redes sociais'
            }...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-gray-100 rounded-2xl pl-12 pr-6 py-3 focus:ring-2 focus:ring-brand-secondary shadow-sm"
          />
        </div>
        <button 
          onClick={() => {
            if (activeTab === 'users') {
              setEditingUser({ role: 'member', status: 'active' } as UserProfile);
              setIsUserModalOpen(true);
            } else if (activeTab === 'products') {
              setEditingProduct({});
              setIsModalOpen(true);
            } else if (activeTab === 'categories') {
              setEditingCategory({});
              setIsCategoryModalOpen(true);
            } else if (activeTab === 'banners') {
              setEditingBanner({ active: true, type: 'hero' });
              setIsBannerModalOpen(true);
            } else if (activeTab === 'articles') {
              setEditingArticle({ type: 'article', status: 'active' });
              setIsArticleModalOpen(true);
            } else if (activeTab === 'social') {
              setEditingSocialLink({ active: true, platform: '', url: '', icon: 'Instagram' });
              setIsSocialModalOpen(true);
            }
          }}
          className={cn(
            "w-full md:w-auto bg-brand-tertiary text-white px-8 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-brand-tertiary/90 transition-all",
            (activeTab === 'settings' || activeTab === 'dashboard') && "hidden"
          )}
        >
          <Plus size={20} />
          {activeTab === 'users' ? 'Novo Usuário' : 
           activeTab === 'products' ? 'Novo Produto' : 
           activeTab === 'categories' ? 'Nova Categoria' : 
           activeTab === 'banners' ? 'Novo Banner' : 
           activeTab === 'articles' ? 'Novo Conteúdo' : 'Nova Rede Social'}
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <Dashboard 
          usersCount={users.length}
          activeProductsCount={products.filter(p => p.status !== 'inactive' && p.status !== 'deleted').length}
          publishedArticlesCount={articles.filter(a => a.status !== 'inactive' && a.status !== 'deleted').length}
          lowStockProducts={products.filter(p => (p.stock || 0) < 5)}
        />
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-8 py-5 font-bold text-gray-700">Usuário</th>
                  <th className="px-8 py-5 font-bold text-gray-700">Função</th>
                  <th className="px-8 py-5 font-bold text-gray-700">Status</th>
                  <th className="px-8 py-5 font-bold text-gray-700 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map(u => (
                  <tr key={u.uid} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-brand-tertiary/10 flex items-center justify-center overflow-hidden">
                          {u.photoURL ? <img src={u.photoURL} alt="" className="w-full h-full object-cover" /> : <UserIcon className="text-brand-tertiary" size={20} />}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{u.displayName || 'Sem nome'}</div>
                          <div className="text-sm text-gray-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <select 
                        value={u.role} 
                        onChange={(e) => handleUpdateUser(u.uid, { role: e.target.value as any })}
                        className="bg-gray-100 border-none rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-brand-secondary"
                      >
                        <option value="Master Admin">Master Admin</option>
                        <option value="Admin">Admin</option>
                        <option value="Afiliado">Afiliado</option>
                        <option value="Parceiro">Parceiro</option>
                        <option value="member">Membro</option>
                      </select>
                    </td>
                    <td className="px-8 py-6">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                        u.status === 'inactive' ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      )}>
                        {u.status === 'inactive' ? 'Inativo' : 'Ativo'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => { setEditingUser(u); setIsUserModalOpen(true); }}
                          className="p-2 text-gray-400 hover:text-brand-secondary transition-colors"
                          title="Editar"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => handleUpdateUser(u.uid, { status: u.status === 'inactive' ? 'active' : 'inactive' })}
                          className="p-2 text-gray-400 hover:text-brand-secondary transition-colors"
                          title={u.status === 'inactive' ? 'Ativar' : 'Desativar'}
                        >
                          {u.status === 'inactive' ? <Power size={18} /> : <PowerOff size={18} />}
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u.uid)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-8 py-5 font-bold text-gray-700">Produto</th>
                  <th className="px-8 py-5 font-bold text-gray-700">Categoria</th>
                  <th className="px-8 py-5 font-bold text-gray-700">Preço</th>
                  <th className="px-8 py-5 font-bold text-gray-700">Status</th>
                  <th className="px-8 py-5 font-bold text-gray-700 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <img src={p.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
                        <div className="font-bold text-gray-900">{p.name}</div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-medium text-gray-600 capitalize">{p.category}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-bold text-brand-tertiary">{p.price}</div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                        p.status === 'inactive' ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      )}>
                        {p.status === 'inactive' ? 'Inativo' : 'Ativo'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => { setEditingProduct(p); setIsModalOpen(true); }}
                          className="p-2 text-gray-400 hover:text-brand-secondary transition-colors"
                          title="Editar"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => handleUpdateProduct(p, { status: p.status === 'inactive' ? 'active' : 'inactive' })}
                          className="p-2 text-gray-400 hover:text-brand-secondary transition-colors"
                          title={p.status === 'inactive' ? 'Ativar' : 'Desativar'}
                        >
                          {p.status === 'inactive' ? <Power size={18} /> : <PowerOff size={18} />}
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(p)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-8 py-5 font-bold text-gray-700">Categoria</th>
                  <th className="px-8 py-5 font-bold text-gray-700">Slug</th>
                  <th className="px-8 py-5 font-bold text-gray-700 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCategories.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="font-bold text-gray-900">{c.name}</div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-medium text-gray-600">{c.slug}</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => { setEditingCategory(c); setIsCategoryModalOpen(true); }}
                          className="p-2 text-gray-400 hover:text-brand-secondary transition-colors"
                          title="Editar"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteCategory(c.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'articles' && (
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-8 py-5 font-bold text-gray-700">Conteúdo</th>
                  <th className="px-8 py-5 font-bold text-gray-700">Tipo</th>
                  <th className="px-8 py-5 font-bold text-gray-700">Categoria</th>
                  <th className="px-8 py-5 font-bold text-gray-700">Status</th>
                  <th className="px-8 py-5 font-bold text-gray-700 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredArticles.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <img src={a.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
                        <div className="font-bold text-gray-900">{a.title}</div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-medium text-gray-600 uppercase">{a.type}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-medium text-gray-600">{a.category}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                        a.status === 'inactive' ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      )}>
                        {a.status === 'inactive' ? 'Inativo' : 'Ativo'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => { setEditingArticle(a); setIsArticleModalOpen(true); }}
                          className="p-2 text-gray-400 hover:text-brand-secondary transition-colors"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => handleUpdateArticleStatus(a, a.status === 'inactive' ? 'active' : 'inactive')}
                          className="p-2 text-gray-400 hover:text-brand-secondary transition-colors"
                        >
                          {a.status === 'inactive' ? <Power size={18} /> : <PowerOff size={18} />}
                        </button>
                        <button 
                          onClick={() => handleDeleteArticle(a)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {activeTab === 'banners' && (
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-8 py-5 font-bold text-gray-700">Banner</th>
                  <th className="px-8 py-5 font-bold text-gray-700">Tipo</th>
                  <th className="px-8 py-5 font-bold text-gray-700">Status</th>
                  <th className="px-8 py-5 font-bold text-gray-700 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBanners.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <img src={b.imageUrl} alt="" className="w-20 h-12 rounded-lg object-cover" />
                        <div className="font-bold text-gray-900">{b.title}</div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-medium text-gray-600 uppercase">{b.type}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                        !b.active ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      )}>
                        {!b.active ? 'Inativo' : 'Ativo'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => { setEditingBanner(b); setIsBannerModalOpen(true); }}
                          className="p-2 text-gray-400 hover:text-brand-secondary transition-colors"
                          title="Editar"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteBanner(b.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'social' && (
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-8 py-5 font-bold text-gray-700">Plataforma</th>
                  <th className="px-8 py-5 font-bold text-gray-700">URL</th>
                  <th className="px-8 py-5 font-bold text-gray-700">Status</th>
                  <th className="px-8 py-5 font-bold text-gray-700 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSocialLinks.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-brand-tertiary">
                          {{
                            Instagram: Instagram,
                            Youtube: Youtube,
                            Facebook: Facebook,
                            Twitter: Twitter,
                            Linkedin: Linkedin,
                            MessageCircle: MessageCircle
                          }[s.icon] ? React.createElement({
                            Instagram: Instagram,
                            Youtube: Youtube,
                            Facebook: Facebook,
                            Twitter: Twitter,
                            Linkedin: Linkedin,
                            MessageCircle: MessageCircle
                          }[s.icon] as any, { size: 20 }) : <Share2 size={20} />}
                        </div>
                        <div className="font-bold text-gray-900">{s.platform}</div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm text-gray-500 truncate max-w-xs">{s.url}</div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                        !s.active ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      )}>
                        {!s.active ? 'Inativo' : 'Ativo'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => { setEditingSocialLink(s); setIsSocialModalOpen(true); }}
                          className="p-2 text-gray-400 hover:text-brand-secondary transition-colors"
                          title="Editar"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteSocialLink(s.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'settings' && appConfig && (
        <div className="bg-white rounded-[40px] p-10 border border-gray-100 shadow-xl max-w-2xl">
          <h3 className="text-3xl font-black text-brand-tertiary mb-8 flex items-center gap-3">
            <Settings className="text-brand-secondary" size={32} />
            Configurações do Sistema
          </h3>
          <form onSubmit={handleSaveConfig} className="space-y-8">
            <div className="space-y-3">
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-widest">Número do WhatsApp</label>
              <div className="relative">
                <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text"
                  value={appConfig.whatsappNumber}
                  onChange={(e) => setAppConfig({ ...appConfig, whatsappNumber: e.target.value })}
                  className="w-full bg-gray-50 border-none rounded-2xl pl-12 pr-6 py-4 focus:ring-2 focus:ring-brand-secondary font-medium"
                  placeholder="Ex: 5511999999999"
                  required
                />
              </div>
              <p className="text-xs text-gray-400">Inclua o código do país (55) e o DDD.</p>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-widest">Mensagem Padrão</label>
              <textarea 
                value={appConfig.whatsappMessage}
                onChange={(e) => setAppConfig({ ...appConfig, whatsappMessage: e.target.value })}
                className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary h-40 resize-none font-medium"
                placeholder="Mensagem que o usuário enviará ao clicar no botão"
                required
              />
            </div>
            <div className="pt-4">
              <button 
                type="submit"
                className="w-full bg-brand-tertiary text-white py-5 rounded-3xl font-bold text-lg shadow-xl shadow-brand-tertiary/20 hover:bg-brand-tertiary/90 transition-all flex items-center justify-center gap-3"
              >
                <Save size={24} />
                Salvar Configurações
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User Modal */}
      <AnimatePresence>
        {isUserModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUserModalOpen(false)}
              className="absolute inset-0 bg-brand-tertiary/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-2xl font-bold text-brand-tertiary">
                  {editingUser?.uid ? 'Editar Usuário' : 'Novo Usuário'}
                </h3>
                <button onClick={() => setIsUserModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={editingUser?.uid ? (e) => { e.preventDefault(); handleUpdateUser(editingUser.uid, editingUser); } : handleCreateUser} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Nome Completo</label>
                  <input 
                    required
                    type="text" 
                    value={editingUser?.displayName || ''} 
                    onChange={e => setEditingUser({...editingUser!, displayName: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">E-mail</label>
                  <input 
                    required
                    type="email" 
                    value={editingUser?.email || ''} 
                    onChange={e => setEditingUser({...editingUser!, email: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Função</label>
                  <select 
                    required
                    value={editingUser?.role || 'member'} 
                    onChange={e => setEditingUser({...editingUser!, role: e.target.value as any})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                  >
                    <option value="Master Admin">Master Admin</option>
                    <option value="Admin">Admin</option>
                    <option value="Afiliado">Afiliado</option>
                    <option value="Parceiro">Parceiro</option>
                    <option value="member">Membro</option>
                  </select>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-brand-primary text-brand-tertiary py-5 rounded-3xl font-bold text-lg shadow-xl shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all"
                >
                  Salvar Usuário
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-brand-tertiary/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-2xl font-bold text-brand-tertiary">
                  {editingProduct?.id ? 'Editar Produto' : 'Novo Produto'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSaveProduct} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Nome do Produto</label>
                    <input 
                      required
                      type="text" 
                      value={editingProduct?.name || ''} 
                      onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Categoria</label>
                    <select 
                      required
                      value={editingProduct?.category || ''} 
                      onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                    >
                      <option value="">Selecione</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.slug}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Preço Atual</label>
                    <input 
                      required
                      type="text" 
                      placeholder="R$ 0,00"
                      value={editingProduct?.price || ''} 
                      onChange={e => setEditingProduct({...editingProduct, price: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Preço Original</label>
                    <input 
                      type="text" 
                      placeholder="R$ 0,00"
                      value={editingProduct?.originalPrice || ''} 
                      onChange={e => setEditingProduct({...editingProduct, originalPrice: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Estoque</label>
                    <input 
                      type="number" 
                      placeholder="Quantidade"
                      value={editingProduct?.stock || 0} 
                      onChange={e => setEditingProduct({...editingProduct, stock: parseInt(e.target.value) || 0})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">URL da Imagem</label>
                  <input 
                    required
                    type="url" 
                    value={editingProduct?.imageUrl || ''} 
                    onChange={e => setEditingProduct({...editingProduct, imageUrl: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">URL de Vendas</label>
                  <input 
                    required
                    type="url" 
                    value={editingProduct?.salesUrl || ''} 
                    onChange={e => setEditingProduct({...editingProduct, salesUrl: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Benefícios (um por linha)</label>
                  <textarea 
                    value={editingProduct?.benefits?.join('\n') || ''} 
                    onChange={e => setEditingProduct({...editingProduct, benefits: e.target.value.split('\n').filter(b => b.trim() !== '')})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary h-32 resize-none"
                    placeholder="Ex: Queima de gordura&#10;Controle de apetite"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Descrição</label>
                  <textarea 
                    required
                    value={editingProduct?.description || ''} 
                    onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary h-32 resize-none"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-brand-primary text-brand-tertiary py-5 rounded-3xl font-bold text-lg shadow-xl shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all"
                >
                  Salvar Produto
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Modal */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute inset-0 bg-brand-tertiary/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-2xl font-bold text-brand-tertiary">
                  {editingCategory?.id ? 'Editar Categoria' : 'Nova Categoria'}
                </h3>
                <button onClick={() => setIsCategoryModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSaveCategory} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Nome da Categoria</label>
                  <input 
                    required
                    type="text" 
                    value={editingCategory?.name || ''} 
                    onChange={e => {
                      const name = e.target.value;
                      const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
                      setEditingCategory({...editingCategory!, name, slug});
                    }}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Slug (URL)</label>
                  <input 
                    required
                    type="text" 
                    value={editingCategory?.slug || ''} 
                    onChange={e => setEditingCategory({...editingCategory!, slug: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-brand-primary text-brand-tertiary py-5 rounded-3xl font-bold text-lg shadow-xl shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all"
                >
                  Salvar Categoria
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Banner Modal */}
      <AnimatePresence>
        {isBannerModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBannerModalOpen(false)}
              className="absolute inset-0 bg-brand-tertiary/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-2xl font-bold text-brand-tertiary">
                  {editingBanner?.id ? 'Editar Banner' : 'Novo Banner'}
                </h3>
                <button onClick={() => setIsBannerModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSaveBanner} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Título do Banner</label>
                  <input 
                    required
                    type="text" 
                    value={editingBanner?.title || ''} 
                    onChange={e => setEditingBanner({...editingBanner!, title: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">URL da Imagem</label>
                  <input 
                    required
                    type="url" 
                    value={editingBanner?.imageUrl || ''} 
                    onChange={e => setEditingBanner({...editingBanner!, imageUrl: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Link (opcional)</label>
                  <input 
                    type="url" 
                    value={editingBanner?.link || ''} 
                    onChange={e => setEditingBanner({...editingBanner!, link: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Tipo</label>
                    <select 
                      value={editingBanner?.type || 'hero'} 
                      onChange={e => setEditingBanner({...editingBanner!, type: e.target.value as any})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                    >
                      <option value="hero">Hero (Home)</option>
                      <option value="promo">Promocional</option>
                      <option value="other">Outro</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Status</label>
                    <select 
                      value={editingBanner?.active ? 'true' : 'false'} 
                      onChange={e => setEditingBanner({...editingBanner!, active: e.target.value === 'true'})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                    >
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-brand-primary text-brand-tertiary py-5 rounded-3xl font-bold text-lg shadow-xl shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all"
                >
                  Salvar Banner
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Article Modal */}
      <AnimatePresence>
        {isArticleModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsArticleModalOpen(false)}
              className="absolute inset-0 bg-brand-tertiary/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-2xl font-bold text-brand-tertiary">
                  {editingArticle?.id ? 'Editar Conteúdo' : 'Novo Conteúdo'}
                </h3>
                <button onClick={() => setIsArticleModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSaveArticle} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Título</label>
                    <input 
                      required
                      type="text" 
                      value={editingArticle?.title || ''} 
                      onChange={e => setEditingArticle({...editingArticle!, title: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Categoria</label>
                    <input 
                      required
                      type="text" 
                      value={editingArticle?.category || ''} 
                      onChange={e => setEditingArticle({...editingArticle!, category: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Tipo</label>
                    <select 
                      value={editingArticle?.type || 'article'} 
                      onChange={e => setEditingArticle({...editingArticle!, type: e.target.value as any})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                    >
                      <option value="article">Artigo</option>
                      <option value="video">Vídeo</option>
                      <option value="guide">Guia</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Status</label>
                    <select 
                      value={editingArticle?.status || 'active'} 
                      onChange={e => setEditingArticle({...editingArticle!, status: e.target.value as any})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Autor</label>
                    <input 
                      type="text" 
                      value={editingArticle?.author || ''} 
                      onChange={e => setEditingArticle({...editingArticle!, author: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                      placeholder="Ex: Equipe Secabucho"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Tempo de Leitura</label>
                    <input 
                      type="text" 
                      value={editingArticle?.readTime || ''} 
                      onChange={e => setEditingArticle({...editingArticle!, readTime: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                      placeholder="Ex: 5 min"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">URL da Imagem</label>
                  <input 
                    required
                    type="url" 
                    value={editingArticle?.imageUrl || ''} 
                    onChange={e => setEditingArticle({...editingArticle!, imageUrl: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Resumo (Excerpt)</label>
                  <textarea 
                    required
                    value={editingArticle?.excerpt || ''} 
                    onChange={e => setEditingArticle({...editingArticle!, excerpt: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary h-24 resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Conteúdo Completo (Markdown)</label>
                  <textarea 
                    value={editingArticle?.content || ''} 
                    onChange={e => setEditingArticle({...editingArticle!, content: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary h-48 resize-none"
                    placeholder="Escreva o conteúdo aqui..."
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-brand-primary text-brand-tertiary py-5 rounded-3xl font-bold text-lg shadow-xl shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all"
                >
                  Salvar Conteúdo
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Social Link Modal */}
      <AnimatePresence>
        {isSocialModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSocialModalOpen(false)}
              className="absolute inset-0 bg-brand-tertiary/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-2xl font-bold text-brand-tertiary">
                  {editingSocialLink?.id ? 'Editar Rede Social' : 'Nova Rede Social'}
                </h3>
                <button onClick={() => setIsSocialModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSaveSocialLink} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Plataforma</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Ex: Instagram, YouTube, Facebook"
                    value={editingSocialLink?.platform || ''} 
                    onChange={e => setEditingSocialLink({...editingSocialLink!, platform: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">URL do Link</label>
                  <input 
                    required
                    type="url" 
                    placeholder="https://..."
                    value={editingSocialLink?.url || ''} 
                    onChange={e => setEditingSocialLink({...editingSocialLink!, url: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Ícone</label>
                    <select 
                      value={editingSocialLink?.icon || 'Instagram'} 
                      onChange={e => setEditingSocialLink({...editingSocialLink!, icon: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                    >
                      <option value="Instagram">Instagram</option>
                      <option value="Youtube">YouTube</option>
                      <option value="Facebook">Facebook</option>
                      <option value="Twitter">Twitter</option>
                      <option value="Linkedin">LinkedIn</option>
                      <option value="MessageCircle">WhatsApp/Telegram</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Status</label>
                    <select 
                      value={editingSocialLink?.active ? 'true' : 'false'} 
                      onChange={e => setEditingSocialLink({...editingSocialLink!, active: e.target.value === 'true'})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary"
                    >
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-brand-primary text-brand-tertiary py-5 rounded-3xl font-bold text-lg shadow-xl shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all"
                >
                  Salvar Rede Social
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-brand-tertiary/60 backdrop-blur-sm"
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">{confirmModal.title}</h3>
              <p className="text-gray-500 mb-8">{confirmModal.message}</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-4 rounded-2xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-4 rounded-2xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MobileFooter = ({ user, onNavigate, currentView }: { 
  user: UserProfile | null, 
  onNavigate: (view: string) => void,
  currentView: string
}) => {
  const items = [
    { id: 'home', label: 'Início', icon: <Zap size={20} /> },
    { id: 'products', label: 'Produtos', icon: <ShoppingBag size={20} /> },
    { id: 'education', label: 'Top Dicas', icon: <BookOpen size={20} /> },
  ];

  if (user) {
    items.push({ id: 'dashboard', label: 'Membros', icon: <ShieldCheck size={20} /> });
    if (user.role === 'Master Admin' || user.role === 'Admin') {
      items.push({ id: 'admin', label: 'Admin', icon: <Settings size={20} /> });
    }
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-4 py-3 flex justify-around items-center shadow-[0_-4px_20px_rgba(0,0,0,0.05)] transition-colors duration-300">
      {items.map(item => (
        <button 
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            currentView === item.id ? "text-brand-secondary dark:text-brand-primary" : "text-gray-400 dark:text-gray-500"
          )}
        >
          {item.icon}
          <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

const Navbar = ({ user, onLogin, onLogout, onNavigate, currentView, isDarkMode, setIsDarkMode }: { 
  user: UserProfile | null, 
  onLogin: () => void, 
  onLogout: () => void,
  onNavigate: (view: string) => void,
  currentView: string,
  isDarkMode: boolean,
  setIsDarkMode: (val: boolean) => void
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Início', icon: <Zap size={18} /> },
    { id: 'products', label: 'Produtos', icon: <ShoppingBag size={18} /> },
    { id: 'education', label: 'Top Dicas', icon: <BookOpen size={18} /> },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FFD700] dark:bg-gray-900 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('home')}>
            <div className="w-10 h-10 bg-brand-tertiary rounded-xl flex items-center justify-center text-brand-primary shadow-lg shadow-brand-tertiary/20">
              <Zap size={24} />
            </div>
            <span className="text-2xl font-bold tracking-tighter text-brand-tertiary dark:text-brand-primary">SECABUCHO</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map(item => (
              <button 
                key={item.id}
                onClick={() => onNavigate(item.id)} 
                className={cn(
                  "flex items-center gap-2 font-medium transition-colors",
                  currentView === item.id ? "text-brand-secondary dark:text-brand-primary" : "text-gray-600 dark:text-gray-300 hover:text-brand-secondary dark:hover:text-brand-primary"
                )}
              >
                {item.label}
              </button>
            ))}
            
            {user && (user.role === 'Master Admin' || user.role === 'Admin') && (
              <button 
                onClick={() => onNavigate('admin')} 
                className={cn(
                  "font-medium transition-colors",
                  currentView === 'admin' ? "text-brand-secondary dark:text-brand-primary" : "text-gray-600 dark:text-gray-300 hover:text-brand-secondary dark:hover:text-brand-primary"
                )}
              >
                Painel Admin
              </button>
            )}

            {user && (
              <button 
                onClick={() => onNavigate('dashboard')} 
                className={cn(
                  "font-medium transition-colors",
                  currentView === 'dashboard' ? "text-brand-secondary dark:text-brand-primary" : "text-gray-600 dark:text-gray-300 hover:text-brand-secondary dark:hover:text-brand-primary"
                )}
              >
                Área de Membros
              </button>
            )}
            
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-brand-tertiary dark:text-brand-primary"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            
            {user ? (
              <div className="flex items-center gap-4 pl-4 border-l border-gray-200">
                <button 
                  onClick={() => onNavigate('profile')}
                  className="flex items-center gap-2 group"
                >
                  <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-brand-secondary/20 group-hover:border-brand-secondary transition-all" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-brand-secondary dark:group-hover:text-brand-primary transition-colors">Perfil</span>
                </button>
                <button onClick={onLogout} className="text-gray-400 hover:text-red-600 transition-colors">
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => onNavigate('login')}
                className="bg-brand-primary text-brand-tertiary px-6 py-2.5 rounded-full font-semibold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 flex items-center gap-2"
              >
                <LogIn size={18} />
                Entrar
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden flex items-center gap-4">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-brand-tertiary dark:text-brand-primary"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
            </button>
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-600 dark:text-gray-300">
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-6 flex flex-col gap-4"
          >
            {navItems.map(item => (
              <button 
                key={item.id}
                onClick={() => { onNavigate(item.id); setIsOpen(false); }} 
                className="text-left text-lg font-medium text-gray-700 dark:text-gray-200 flex items-center gap-3"
              >
                {item.icon}
                {item.label}
              </button>
            ))}
            {user && (
              <>
                { (user.role === 'Master Admin' || user.role === 'Admin') && (
                  <button onClick={() => { onNavigate('admin'); setIsOpen(false); }} className="text-left text-lg font-medium text-gray-700 flex items-center gap-3">
                    <Users size={18} />
                    Painel Admin
                  </button>
                )}
                <button onClick={() => { onNavigate('dashboard'); setIsOpen(false); }} className="text-left text-lg font-medium text-gray-700 flex items-center gap-3">
                  <ShieldCheck size={18} />
                  Área de Membros
                </button>
                <button onClick={() => { onNavigate('profile'); setIsOpen(false); }} className="text-left text-lg font-medium text-gray-700 flex items-center gap-3">
                  <UserIcon size={18} />
                  Meu Perfil
                </button>
              </>
            )}
            <div className="pt-4 border-t border-gray-100">
              {user ? (
                <button onClick={() => { onLogout(); setIsOpen(false); }} className="flex items-center gap-2 text-red-600 font-semibold">
                  <LogOut size={20} />
                  Sair da Conta
                </button>
              ) : (
                <button onClick={() => { onNavigate('login'); setIsOpen(false); }} className="w-full bg-brand-primary text-brand-tertiary py-3 rounded-xl font-bold">Entrar</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const ProductCard: React.FC<{ product: Product }> = ({ product }) => (
  <motion.div 
    whileHover={{ y: -10 }}
    className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all flex flex-col"
  >
    <div className="relative aspect-square overflow-hidden">
      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-brand-tertiary uppercase tracking-wider">
        {product.category}
      </div>
    </div>
    <div className="p-8 flex flex-col flex-grow">
      <h3 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h3>
      <p className="text-gray-500 text-sm mb-6 line-clamp-2">{product.description}</p>
      
      <div className="space-y-2 mb-8">
        {(product.benefits || []).slice(0, 3).map((benefit, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle size={14} className="text-brand-primary" />
            {benefit}
          </div>
        ))}
      </div>

      <div className="mt-auto">
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-black text-brand-tertiary">{product.price}</span>
          {product.originalPrice && (
            <span className="text-sm text-gray-400 line-through">{product.originalPrice}</span>
          )}
        </div>
        <a 
          href={product.salesUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-full bg-brand-primary text-brand-tertiary py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-brand-primary/90 transition-colors"
        >
          Comprar Agora
          <ShoppingBag size={18} />
        </a>
      </div>
    </div>
  </motion.div>
);

const ProfileView = ({ user, onUpdate }: { user: UserProfile, onUpdate: (data: Partial<UserProfile>) => void }) => {
  const [formData, setFormData] = useState<Partial<UserProfile>>(user);
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: ['age', 'targetWeight', 'height', 'currentWeight'].includes(name) ? Number(value) : value 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onUpdate(formData);
    setSaving(false);
    // Success feedback is handled by the parent or could be a local state
  };

  return (
    <div className="pt-32 pb-20 max-w-5xl mx-auto px-4">
      <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
        <div className="bg-brand-tertiary p-12 text-white relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <img src={user.photoURL || ''} alt="" className="w-32 h-32 rounded-3xl border-4 border-white/20 shadow-lg" />
            <div className="text-center md:text-left">
              <h2 className="text-4xl font-bold mb-2">{user.displayName}</h2>
              <p className="text-brand-primary text-lg mb-4">{user.email}</p>
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 rounded-full text-sm font-bold uppercase tracking-widest">
                  {user.role}
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-primary text-brand-tertiary rounded-full text-sm font-bold uppercase tracking-widest">
                  <Zap size={14} />
                  {user.points || 0} Pontos
                </div>
              </div>
            </div>
          </div>
          <Sparkles className="absolute -top-10 -right-10 text-brand-primary/10 w-64 h-64" />
        </div>

        <form onSubmit={handleSubmit} className="p-12">
          <div className="grid md:grid-cols-2 gap-12 mb-12">
            {/* Basic Info */}
            <div className="space-y-8">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3 border-b border-gray-100 pb-4">
                <UserIcon size={24} className="text-brand-secondary" />
                Informações Pessoais
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Idade</label>
                  <input 
                    type="number" name="age" value={formData.age || ''} onChange={handleChange}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary transition-all"
                    placeholder="Ex: 25"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Gênero</label>
                  <select 
                    name="gender" value={formData.gender || ''} onChange={handleChange}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary transition-all"
                  >
                    <option value="">Selecione</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Altura (cm)</label>
                  <input 
                    type="number" name="height" value={formData.height || ''} onChange={handleChange}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary transition-all"
                    placeholder="Ex: 175"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Peso Atual (kg)</label>
                  <input 
                    type="number" name="currentWeight" value={formData.currentWeight || ''} onChange={handleChange}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary transition-all"
                    placeholder="Ex: 80"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Bio / Sobre Você</label>
                <textarea 
                  name="bio" value={formData.bio || ''} onChange={handleChange}
                  className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary transition-all h-32 resize-none"
                  placeholder="Conte um pouco sobre sua jornada..."
                />
              </div>
            </div>

            {/* Health Goals */}
            <div className="space-y-8">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3 border-b border-gray-100 pb-4">
                <Heart size={24} className="text-brand-secondary" />
                Metas e Estilo de Vida
              </h3>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Objetivo Principal</label>
                <select 
                  name="healthGoal" value={formData.healthGoal || ''} onChange={handleChange}
                  className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary transition-all"
                >
                  <option value="">Selecione</option>
                  <option value="Perda de Peso">Perda de Peso</option>
                  <option value="Ganho de Massa">Ganho de Massa</option>
                  <option value="Manutenção">Manutenção</option>
                  <option value="Definição">Definição</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Peso Desejado (kg)</label>
                  <input 
                    type="number" name="targetWeight" value={formData.targetWeight || ''} onChange={handleChange}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary transition-all"
                    placeholder="Ex: 70"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Nível de Atividade</label>
                  <select 
                    name="activityLevel" value={formData.activityLevel || ''} onChange={handleChange}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary transition-all"
                  >
                    <option value="">Selecione</option>
                    <option value="Sedentário">Sedentário</option>
                    <option value="Leve">Leve (1-2x/semana)</option>
                    <option value="Moderado">Moderado (3-5x/semana)</option>
                    <option value="Intenso">Intenso (6-7x/semana)</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Restrições Alimentares</label>
                <input 
                  type="text" name="dietaryRestrictions" value={formData.dietaryRestrictions || ''} onChange={handleChange}
                  className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary transition-all"
                  placeholder="Ex: Vegano, Sem Glúten, Alergia a amendoim..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Preocupações Estéticas</label>
                <input 
                  type="text" name="beautyConcerns" value={formData.beautyConcerns || ''} onChange={handleChange}
                  className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary transition-all"
                  placeholder="Ex: Acne, Rugas, Manchas..."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button 
              type="submit"
              disabled={saving}
              className="bg-brand-primary text-brand-tertiary px-12 py-5 rounded-3xl font-bold text-xl shadow-2xl shadow-brand-primary/30 hover:bg-brand-primary/90 transition-all flex items-center gap-3 disabled:opacity-50"
            >
              {saving ? <Zap className="animate-spin" /> : <Save size={24} />}
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EducationView = ({ onSelectArticle, userPoints, onUpdatePoints, articles }: { 
  onSelectArticle: (article: Article) => void,
  userPoints: number,
  onUpdatePoints: (points: number) => void,
  articles: Article[]
}) => {
  const [activeQuiz, setActiveQuiz] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const categories = ['all', ...new Set(articles.map(a => a.category))];

  const filteredArticles = articles.filter(a => 
    (selectedCategory === 'all' || a.category === selectedCategory) &&
    (a.title.toLowerCase().includes(searchTerm.toLowerCase()) || a.excerpt.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAnswer = (index: number) => {
    const isCorrect = index === QUIZ_QUESTIONS[currentQuestion].correctAnswer;
    if (isCorrect) {
      setQuizScore(prev => (prev || 0) + 1);
    }
    
    if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      const finalScore = (quizScore || 0) + (isCorrect ? 1 : 0);
      const pointsEarned = finalScore * 10;
      onUpdatePoints(userPoints + pointsEarned);
      setActiveQuiz(-1); // Finished
    }
  };

  const resetQuiz = () => {
    setActiveQuiz(null);
    setQuizScore(null);
    setCurrentQuestion(0);
  };

  return (
    <div className="pt-32 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <h2 className="text-5xl font-extrabold mb-4">Top <span className="text-brand-secondary">Dicas</span></h2>
        <p className="text-gray-500 max-w-2xl mx-auto">Aprenda com especialistas e teste seus conhecimentos para uma vida mais saudável.</p>
      </div>

      {/* Search and Filter */}
      <div className="mb-12 space-y-6">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
          <input 
            type="text"
            placeholder="Pesquisar conteúdos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border-none rounded-full px-16 py-6 text-lg shadow-xl shadow-gray-100 focus:ring-2 focus:ring-brand-secondary transition-all"
          />
        </div>
        
        <div className="flex flex-wrap justify-center gap-3">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-6 py-2 rounded-full font-bold text-sm transition-all",
                selectedCategory === cat 
                  ? "bg-brand-tertiary text-white shadow-lg shadow-brand-tertiary/20" 
                  : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-100"
              )}
            >
              {cat === 'all' ? 'Todos' : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-12">
        {/* Articles List */}
        <div className="lg:col-span-2 space-y-12">
          {filteredArticles.length > 0 ? (
            filteredArticles.map(article => (
              <motion.div 
                key={article.id}
                whileHover={{ scale: 1.01 }}
                className="bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-sm flex flex-col md:flex-row"
              >
                <div className="md:w-2/5 relative">
                  <img src={article.imageUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute top-4 left-4 bg-brand-tertiary text-brand-primary px-3 py-1 rounded-full text-xs font-bold uppercase">
                    {article.category}
                  </div>
                  {article.type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <PlayCircle className="text-white w-16 h-16" />
                    </div>
                  )}
                </div>
                <div className="p-8 md:w-3/5 flex flex-col justify-center">
                  <div className="flex items-center gap-2 text-brand-secondary text-xs font-bold uppercase mb-3">
                    {article.type === 'video' ? <PlayCircle size={14} /> : article.type === 'guide' ? <FileText size={14} /> : <BookOpen size={14} />}
                    {article.type}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">{article.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                    {article.author && (
                      <div className="flex items-center gap-1">
                        <UserCheck size={12} />
                        {article.author}
                      </div>
                    )}
                    {article.readTime && (
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        {article.readTime}
                      </div>
                    )}
                  </div>
                  <p className="text-gray-500 mb-6 line-clamp-3">{article.excerpt}</p>
                  <button 
                    onClick={() => onSelectArticle(article)}
                    className="text-brand-secondary font-bold flex items-center gap-2 hover:gap-3 transition-all"
                  >
                    Ler Conteúdo Completo
                    <ArrowRight size={18} />
                  </button>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-20 bg-gray-50 rounded-[40px]">
              <BookOpen className="mx-auto text-gray-300 mb-4" size={64} />
              <h3 className="text-2xl font-bold text-gray-400">Nenhum conteúdo encontrado.</h3>
            </div>
          )}
        </div>

        {/* Sidebar / Quiz */}
        <div className="space-y-8">
          <div className="bg-brand-secondary/5 p-10 rounded-[40px] border border-brand-secondary/20">
            <HelpCircle className="text-brand-secondary mb-6" size={48} />
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Quiz Interativo</h3>
            
            {activeQuiz === null ? (
              <>
                <p className="text-gray-600 mb-8">Teste seus conhecimentos sobre saúde e emagrecimento e ganhe pontos na plataforma!</p>
                <button 
                  onClick={() => setActiveQuiz(0)}
                  className="w-full bg-brand-primary text-brand-tertiary py-4 rounded-2xl font-bold shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all"
                >
                  Iniciar Quiz
                </button>
              </>
            ) : activeQuiz === -1 ? (
              <div className="text-center">
                <div className="text-5xl font-black text-brand-secondary mb-4">{quizScore}/{QUIZ_QUESTIONS.length}</div>
                <p className="font-bold text-gray-900 mb-6">Parabéns! Você concluiu o quiz.</p>
                <button 
                  onClick={resetQuiz}
                  className="w-full bg-brand-primary text-brand-tertiary py-4 rounded-2xl font-bold"
                >
                  Tentar Novamente
                </button>
              </div>
            ) : (
              <div>
                <div className="text-xs font-bold text-brand-secondary mb-2 uppercase tracking-widest">Questão {currentQuestion + 1} de {QUIZ_QUESTIONS.length}</div>
                <h4 className="text-lg font-bold text-gray-900 mb-6">{QUIZ_QUESTIONS[currentQuestion].question}</h4>
                <div className="space-y-3">
                  {QUIZ_QUESTIONS[currentQuestion].options.map((opt, i) => (
                    <button 
                      key={i}
                      onClick={() => handleAnswer(i)}
                      className="w-full bg-white border-2 border-transparent hover:border-brand-primary p-4 rounded-xl text-left font-medium transition-all shadow-sm"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-brand-tertiary p-10 rounded-[40px] text-white">
            <Zap className="text-brand-primary mb-6" size={48} />
            <h3 className="text-2xl font-bold mb-4">Guia de Início Rápido</h3>
            <p className="text-gray-400 mb-8">Baixe nosso PDF gratuito com os 7 passos para a transformação definitiva.</p>
            <button className="w-full bg-brand-primary text-brand-tertiary py-4 rounded-2xl font-bold hover:bg-brand-primary/90 transition-all">
              Baixar Guia (PDF)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

const LoginView = ({ onLogin }: { onLogin: () => void }) => {
  return (
    <div className="min-h-screen pt-32 pb-20 flex items-center justify-center px-4 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-12 text-center border border-gray-100">
        <div className="w-20 h-20 bg-brand-primary/20 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <UserIcon size={40} className="text-brand-tertiary" />
        </div>
        <h2 className="text-4xl font-black text-gray-900 mb-4">Bem-vindo(a)!</h2>
        <p className="text-gray-600 mb-12 text-lg">Faça login para acessar seu perfil personalizado, quizzes e ofertas exclusivas.</p>
        
        <button 
          onClick={onLogin}
          className="w-full flex items-center justify-center gap-4 bg-white border-2 border-gray-100 py-5 rounded-3xl font-bold text-xl text-gray-700 hover:bg-gray-50 hover:border-brand-primary transition-all shadow-lg shadow-gray-200/50"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          Entrar com Google
        </button>

        <div className="mt-12 pt-8 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Ao entrar, você concorda com nossos <br />
            <span className="text-brand-secondary font-bold cursor-pointer">Termos de Uso</span> e <span className="text-brand-secondary font-bold cursor-pointer">Privacidade</span>.
          </p>
        </div>
      </div>
    </div>
  );
};

const WhatsAppButton = ({ config }: { config: AppConfig | null }) => {
  if (!config || !config.whatsappNumber) return null;

  const handleClick = () => {
    const url = `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(config.whatsappMessage)}`;
    window.open(url, '_blank');
  };

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={handleClick}
      className="fixed bottom-24 right-6 md:bottom-10 md:right-10 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-2xl flex items-center justify-center group transition-all"
      title="Fale conosco no WhatsApp"
    >
      <MessageCircle size={32} />
      <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-3 transition-all duration-500 font-bold whitespace-nowrap">
        WhatsApp
      </span>
    </motion.button>
  );
};

function AppContent() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('home');
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [dbCategories, setDbCategories] = useState<Category[]>([]);
  const [dbBanners, setDbBanners] = useState<Banner[]>([]);
  const [dbSocialLinks, setDbSocialLinks] = useState<SocialLink[]>([]);
  const [dbArticles, setDbArticles] = useState<Article[]>([]);
  const [dbConfig, setDbConfig] = useState<AppConfig | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const handleArticleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight > clientHeight) {
      const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
      setReadingProgress(progress);
    } else {
      setReadingProgress(100);
    }
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (selectedArticle) {
      setReadingProgress(0);
    }
  }, [selectedArticle]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const masterEmails = ['tati.fotodesigner@gmail.com', 'jhecksanto@gmail.com'];
        const isMaster = firebaseUser.email && masterEmails.includes(firebaseUser.email);

        const path = `users/${firebaseUser.uid}`;
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            if (isMaster && userData.role !== 'Master Admin') {
              const updatedUser = { ...userData, role: 'Master Admin' as const };
              await updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'Master Admin' });
              setUser(updatedUser);
            } else {
              setUser(userData);
            }
          } else {
            const newUser: UserProfile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName,
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL,
              role: isMaster ? 'Master Admin' : 'member',
              status: 'active',
              createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            setUser(newUser);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    const productsUnsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setDbProducts(productsData);
    });

    const categoriesUnsubscribe = onSnapshot(collection(db, 'categories'), async (snapshot) => {
      const categoriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setDbCategories(categoriesData);

      // Seed categories if empty
      if (snapshot.empty && user && (user.role === 'Master Admin' || user.role === 'Admin')) {
        const initialCategories = [
          { id: 'emagrecimento', name: 'Emagrecimento', slug: 'emagrecimento' },
          { id: 'saude', name: 'Saúde', slug: 'saude' },
          { id: 'beleza', name: 'Beleza', slug: 'beleza' },
          { id: 'fitness', name: 'Fitness', slug: 'fitness' }
        ];
        for (const cat of initialCategories) {
          await setDoc(doc(db, 'categories', cat.id), cat);
        }
      }
    });

    const bannersUnsubscribe = onSnapshot(collection(db, 'banners'), (snapshot) => {
      const bannersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
      setDbBanners(bannersData);
    });

    const socialUnsubscribe = onSnapshot(collection(db, 'social_links'), (snapshot) => {
      const socialData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SocialLink));
      setDbSocialLinks(socialData);
    });

    const articlesUnsubscribe = onSnapshot(collection(db, 'articles'), (snapshot) => {
      const articlesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Article));
      setDbArticles(articlesData);
    });

    const configUnsubscribe = onSnapshot(doc(db, 'configs', 'app_settings'), (snapshot) => {
      if (snapshot.exists()) {
        setDbConfig({ id: snapshot.id, ...snapshot.data() } as AppConfig);
      }
    });

    return () => {
      unsubscribe();
      productsUnsubscribe();
      categoriesUnsubscribe();
      bannersUnsubscribe();
      socialUnsubscribe();
      articlesUnsubscribe();
      configUnsubscribe();
    };
  }, []);

  const allProducts = [...dbProducts, ...PRODUCTS].filter((p, index, self) => 
    index === self.findIndex((t) => t.id === p.id)
  );

  const allArticles = [...dbArticles, ...ARTICLES].filter((a, index, self) => 
    index === self.findIndex((t) => t.id === a.id)
  ).filter(a => a.status !== 'inactive' && a.status !== 'deleted');

  const currentArticleIndex = selectedArticle ? allArticles.findIndex(a => a.id === selectedArticle.id) : -1;
  const prevArticle = currentArticleIndex > 0 ? allArticles[currentArticleIndex - 1] : null;
  const nextArticle = currentArticleIndex !== -1 && currentArticleIndex < allArticles.length - 1 ? allArticles[currentArticleIndex + 1] : null;

  const visibleProducts = allProducts.filter(p => p.status !== 'inactive' && p.status !== 'deleted');
  
  const filteredProducts = selectedCategory === 'all' 
    ? visibleProducts 
    : visibleProducts.filter(p => p.category === selectedCategory);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setCurrentView('home');
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentView('home');
  };

  const handleUpdateProfile = async (data: Partial<UserProfile>, successMessage?: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), data);
      setUser(prev => prev ? { ...prev, ...data } : null);
      setNotification({ message: successMessage || 'Perfil atualizado com sucesso!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      setNotification({ message: 'Erro ao atualizar perfil.', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-brand-secondary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 font-sans text-brand-text dark:text-gray-100 transition-colors duration-300">
      <Navbar 
        user={user} 
        onLogin={handleLogin} 
        onLogout={handleLogout}
        onNavigate={setCurrentView}
        currentView={currentView}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />

      <main>
        {currentView === 'login' && <LoginView onLogin={handleLogin} />}

        {currentView === 'admin' && user && (user.role === 'Master Admin' || user.role === 'Admin') && (
          <AdminPanel user={user} />
        )}

        {currentView === 'profile' && user && (
          <ProfileView user={user} onUpdate={handleUpdateProfile} />
        )}
        
        {currentView === 'home' && (
          <>
            <section className="relative pt-32 pb-20 overflow-hidden">
              <div className="absolute top-0 right-0 -z-10 w-1/2 h-full bg-brand-secondary/5 rounded-l-[100px]" />
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {dbBanners.filter(b => b.active && b.type === 'hero').length > 0 ? (
                  dbBanners.filter(b => b.active && b.type === 'hero').map((banner, idx) => (
                    <div key={banner.id} className={cn("grid lg:grid-cols-2 gap-12 items-center", idx > 0 && "mt-20")}>
                      <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                      >
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-secondary/10 text-brand-secondary rounded-full text-sm font-bold mb-6">
                          <Sparkles size={16} />
                          CORPO SAUDÁVEL, VIDA SAUDÁVEL
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-extrabold text-gray-900 leading-[1.1] mb-6 whitespace-pre-line">
                          {banner.title}
                        </h1>
                        <div className="flex flex-wrap gap-4">
                          <button 
                            onClick={() => banner.link ? window.open(banner.link, '_blank') : setCurrentView('products')}
                            className="bg-brand-primary text-brand-tertiary px-8 py-4 rounded-full font-bold text-lg hover:bg-brand-primary/90 transition-all shadow-xl shadow-brand-primary/20 flex items-center gap-2 group"
                          >
                            {banner.link ? 'Saiba Mais' : 'Ver Produtos'}
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="relative"
                      >
                        <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl">
                          <img src={banner.imageUrl} alt={banner.title} className="w-full h-auto" />
                        </div>
                      </motion.div>
                    </div>
                  ))
                ) : (
                  <div className="grid lg:grid-cols-2 gap-12 items-center">
                    <motion.div
                      initial={{ opacity: 0, x: -50 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.8 }}
                    >
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-secondary/10 text-brand-secondary rounded-full text-sm font-bold mb-6">
                        <Sparkles size={16} />
                        CORPO SAUDÁVEL, VIDA SAUDÁVEL
                      </div>
                      <h1 className="text-5xl lg:text-7xl font-extrabold text-gray-900 leading-[1.1] mb-6">
                        Sua Jornada de <span className="text-brand-secondary">Transformação</span> Começa Aqui
                      </h1>
                      <p className="text-xl text-gray-600 mb-10 max-w-lg leading-relaxed">
                        Acesse conteúdos exclusivos, gerencie suas metas de saúde e descubra os melhores produtos para sua beleza e emagrecimento.
                      </p>
                      <div className="flex flex-wrap gap-4">
                        <button 
                          onClick={() => setCurrentView('products')}
                          className="bg-brand-primary text-brand-tertiary px-8 py-4 rounded-full font-bold text-lg hover:bg-brand-primary/90 transition-all shadow-xl shadow-brand-primary/20 flex items-center gap-2 group"
                        >
                          Ver Produtos
                          <ShoppingBag size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button 
                          onClick={() => setCurrentView('education')}
                          className="bg-white text-gray-900 border-2 border-gray-100 px-8 py-4 rounded-full font-bold text-lg hover:border-brand-secondary/20 transition-all flex items-center gap-2"
                        >
                          <BookOpen size={20} />
                          Aprender Mais
                        </button>
                      </div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className="relative"
                    >
                      <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl">
                        <img src="https://picsum.photos/seed/wellness-main/800/1000" alt="Saúde e Bem-estar" className="w-full h-auto" />
                      </div>
                    </motion.div>
                  </div>
                )}
              </div>
            </section>
            
            {/* Featured Products */}
            <section className="py-20">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-end mb-12">
                  <div>
                    <h2 className="text-4xl font-extrabold text-brand-tertiary mb-2">Destaques da Semana</h2>
                    <p className="text-gray-500">Os produtos mais amados pela nossa comunidade.</p>
                  </div>
                  <button 
                    onClick={() => setCurrentView('products')}
                    className="text-brand-secondary font-bold flex items-center gap-2 hover:gap-3 transition-all"
                  >
                    Ver Todos
                    <ArrowRight size={20} />
                  </button>
                </div>
                <div className="grid md:grid-cols-3 gap-10">
                  {visibleProducts.slice(0, 3).map(p => (
                    <div key={p.id} onClick={() => setSelectedProduct(p)} className="cursor-pointer">
                      <ProductCard product={p} />
                    </div>
                  ))}
                </div>
              </div>
            </section>
            
            {/* Quick Stats Section */}
            <section className="py-20 bg-gray-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-4 gap-8">
                {[
                  { label: "Clientes Ativos", value: "35k+", icon: UserIcon },
                  { label: "Produtos Validados", value: "12+", icon: ShieldCheck },
                  { label: "Dicas de Saúde", value: "500+", icon: Zap },
                  { label: "Satisfação", value: "99%", icon: Star }
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-8 rounded-3xl shadow-sm flex flex-col items-center text-center">
                    <div className="text-brand-secondary mb-4"><stat.icon size={24} /></div>
                    <div className="text-3xl font-black text-gray-900 mb-1">{stat.value}</div>
                    <div className="text-sm text-gray-500 font-bold uppercase tracking-widest">{stat.label}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {currentView === 'products' && (
          <section className="pt-32 pb-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-5xl font-extrabold mb-4">Catálogo de <span className="text-brand-secondary">Produtos</span></h2>
                <p className="text-gray-500 max-w-2xl mx-auto">Suplementos, cosméticos e equipamentos selecionados para sua melhor versão.</p>
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap justify-center gap-4 mb-12">
                <button 
                  onClick={() => setSelectedCategory('all')}
                  className={cn(
                    "px-6 py-2 rounded-full font-bold transition-all",
                    selectedCategory === 'all' ? "bg-brand-tertiary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  Todos
                </button>
                {dbCategories.map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.slug)}
                    className={cn(
                      "px-6 py-2 rounded-full font-bold transition-all",
                      selectedCategory === cat.slug ? "bg-brand-tertiary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
                {filteredProducts.map(p => (
                  <div key={p.id} onClick={() => setSelectedProduct(p)} className="cursor-pointer">
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
              
              {filteredProducts.length === 0 && (
                <div className="text-center py-20">
                  <Package className="mx-auto text-gray-300 mb-4" size={64} />
                  <h3 className="text-2xl font-bold text-gray-400">Nenhum produto encontrado nesta categoria.</h3>
                </div>
              )}
            </div>
          </section>
        )}

        {currentView === 'education' && (
          <EducationView 
            onSelectArticle={setSelectedArticle} 
            userPoints={user?.points || 0}
            articles={allArticles}
            onUpdatePoints={(newPoints) => handleUpdateProfile({ points: newPoints }, 'Parabéns! Você ganhou pontos!')}
          />
        )}

        {currentView === 'dashboard' && user && (
          <div className="pt-32 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
              <div>
                <h2 className="text-4xl font-extrabold text-brand-tertiary mb-2">Área de Membros</h2>
                <p className="text-gray-500">Acompanhe seu progresso e acesse conteúdos exclusivos.</p>
              </div>
              <button 
                onClick={() => setCurrentView('profile')}
                className="bg-gray-100 text-gray-900 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-brand-secondary/10 hover:text-brand-secondary transition-all"
              >
                <Settings size={20} />
                Configurar Perfil
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <div className="bg-brand-tertiary p-10 rounded-[40px] text-white shadow-xl shadow-brand-tertiary/20">
                <div className="flex justify-between items-start mb-6">
                  <Dumbbell size={40} />
                  <div className="bg-brand-primary text-brand-tertiary px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-1">
                    <Zap size={12} />
                    {user.points || 0} pts
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-2">Meta: {user.healthGoal || "Definir Meta"}</h3>
                <p className="text-brand-primary text-sm mb-8">Seu foco atual é {user.healthGoal?.toLowerCase() || "ainda não definido"}.</p>
                <div className="w-full bg-brand-tertiary/50 h-3 rounded-full overflow-hidden">
                  <div className="bg-brand-primary w-1/3 h-full" />
                </div>
                <p className="mt-4 text-xs font-bold uppercase tracking-widest">33% concluído</p>
              </div>
              
              <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm">
                <Droplets className="mb-6 text-brand-secondary" size={40} />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Hidratação</h3>
                <p className="text-gray-500 text-sm mb-8">Lembre-se de beber pelo menos 2.5L de água hoje.</p>
                <button className="bg-brand-secondary/5 text-brand-secondary px-6 py-3 rounded-xl font-bold text-sm">
                  Registrar Copo
                </button>
              </div>

              <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm">
                <Coffee className="mb-6 text-brand-secondary" size={40} />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Dica Nutricional</h3>
                <p className="text-gray-500 text-sm mb-8">O chá verde pode ajudar a acelerar seu metabolismo matinal.</p>
                <button onClick={() => setCurrentView('education')} className="text-brand-secondary font-bold flex items-center gap-2 hover:gap-3 transition-all">
                  Ler Mais Dicas
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <h3 className="text-2xl font-bold text-brand-tertiary mb-8">Novidades no Catálogo</h3>
            <div className="grid md:grid-cols-4 gap-6">
              {visibleProducts.slice(0, 4).map(p => (
                <div key={p.id} onClick={() => setSelectedProduct(p)} className="cursor-pointer">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-brand-tertiary text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center text-brand-tertiary">
                <Zap size={24} />
              </div>
              <span className="text-2xl font-bold tracking-tighter">SECABUCHO</span>
            </div>
            <p className="text-gray-400 max-w-sm mb-8">
              Transformando vidas através da nutrição inteligente e acompanhamento personalizado. Junte-se a mais de 35 mil pessoas.
            </p>
            <div className="flex gap-4">
              {dbSocialLinks.filter(s => s.active).map(social => {
                const IconComponent = {
                  Instagram: Instagram,
                  Youtube: Youtube,
                  Facebook: Facebook,
                  Twitter: Twitter,
                  Linkedin: Linkedin,
                  MessageCircle: MessageCircle
                }[social.icon] || Share2;

                return (
                  <a 
                    key={social.id}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-brand-primary hover:text-brand-tertiary transition-colors cursor-pointer"
                    title={social.platform}
                  >
                    <IconComponent size={18} />
                  </a>
                );
              })}
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-6">Navegação</h4>
            <ul className="space-y-4 text-gray-400">
              <li><button onClick={() => setCurrentView('home')} className="hover:text-brand-primary transition-colors">Início</button></li>
              <li><button onClick={() => setCurrentView('products')} className="hover:text-brand-primary transition-colors">Produtos</button></li>
              <li><button onClick={() => setCurrentView('education')} className="hover:text-brand-primary transition-colors">Top Dicas</button></li>
              <li><button onClick={() => setCurrentView('dashboard')} className="hover:text-brand-primary transition-colors">Área de Membros</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6">Contato</h4>
            <ul className="space-y-4 text-gray-400">
              <li>(28) 99988-1386</li>
              <li>suporte@secabucho.app.br</li>
              <li>Atendimento: Seg-Sex 09h-18h</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
          <p>&copy; 2026 SECABUCHO. Todos os direitos reservados. Aprovado pela ANVISA.</p>
        </div>
      </footer>
      <MobileFooter 
        user={user} 
        onNavigate={setCurrentView} 
        currentView={currentView} 
      />
      <WhatsAppButton config={dbConfig} />

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200]"
          >
            <div className={cn(
              "px-8 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3",
              notification.type === 'success' ? "bg-green-600 text-white" : "bg-red-600 text-white"
            )}>
              {notification.type === 'success' ? <CheckCircle size={20} /> : <Zap size={20} />}
              {notification.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Details Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 bg-brand-tertiary/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 50 }}
              className="relative bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row"
            >
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-6 right-6 z-10 w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-400 hover:text-gray-900 transition-all shadow-lg"
              >
                <X size={24} />
              </button>

              <div className="md:w-1/2 relative bg-gray-50">
                <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                <div className="absolute top-8 left-8 bg-brand-primary text-brand-tertiary px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-widest">
                  {selectedProduct.category}
                </div>
              </div>

              <div className="md:w-1/2 p-12 flex flex-col">
                <div className="mb-8">
                  <h2 className="text-4xl font-black text-brand-tertiary mb-4">{selectedProduct.name}</h2>
                  <div className="flex items-baseline gap-3 mb-6">
                    <span className="text-4xl font-black text-brand-secondary">{selectedProduct.price}</span>
                    {selectedProduct.originalPrice && (
                      <span className="text-lg text-gray-400 line-through">{selectedProduct.originalPrice}</span>
                    )}
                  </div>
                  <p className="text-gray-600 leading-relaxed text-lg">{selectedProduct.description}</p>
                </div>

                <div className="space-y-4 mb-10">
                  <h4 className="font-bold text-gray-900 uppercase tracking-widest text-sm">Principais Benefícios:</h4>
                  <div className="grid grid-cols-1 gap-3">
                    {(selectedProduct.benefits || []).map((benefit, i) => (
                      <div key={i} className="flex items-center gap-3 text-gray-700">
                        <div className="w-6 h-6 bg-brand-primary/20 rounded-full flex items-center justify-center text-brand-primary">
                          <CheckCircle size={14} />
                        </div>
                        <span className="font-medium">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-auto flex gap-4">
                  <a 
                    href={selectedProduct.salesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-grow bg-brand-primary text-brand-tertiary py-5 rounded-3xl font-black text-xl flex items-center justify-center gap-3 shadow-xl shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all"
                  >
                    Comprar Agora
                    <ShoppingBag size={24} />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Article Details Modal */}
      <AnimatePresence>
        {selectedArticle && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedArticle(null)}
              className="absolute inset-0 bg-brand-tertiary/60 backdrop-blur-md"
            />

            {/* Desktop Navigation Arrows */}
            {prevArticle && (
              <button 
                onClick={() => setSelectedArticle(prevArticle)}
                className="hidden md:flex absolute left-8 z-[110] w-14 h-14 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full items-center justify-center text-white transition-all hover:scale-110"
                title="Artigo Anterior"
              >
                <ChevronLeft size={32} />
              </button>
            )}
            {nextArticle && (
              <button 
                onClick={() => setSelectedArticle(nextArticle)}
                className="hidden md:flex absolute right-8 z-[110] w-14 h-14 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full items-center justify-center text-white transition-all hover:scale-110"
                title="Próximo Artigo"
              >
                <ChevronRight size={32} />
              </button>
            )}

            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 50 }}
              className="relative bg-white w-full max-w-3xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Reading Progress Bar */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gray-100 z-20">
                <div 
                  className="h-full bg-brand-primary transition-all duration-150 ease-out"
                  style={{ width: `${readingProgress}%` }}
                />
              </div>

              <button 
                onClick={() => setSelectedArticle(null)}
                className="absolute top-6 right-6 z-10 w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-400 hover:text-gray-900 transition-all shadow-lg"
              >
                <X size={24} />
              </button>

              <div 
                className="overflow-y-auto flex-1"
                onScroll={handleArticleScroll}
              >
                <div className="aspect-video relative flex-shrink-0">
                  <img src={selectedArticle.imageUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-tertiary to-transparent opacity-60" />
                  <div className="absolute bottom-8 left-8 right-8">
                    <div className="inline-block bg-brand-primary text-brand-tertiary px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-4">
                      {selectedArticle.category}
                    </div>
                    <h2 className="text-4xl font-black text-white">{selectedArticle.title}</h2>
                  </div>
                </div>

                <div className="p-8 md:p-12">
                  <div className="flex items-center gap-6 mb-8 text-sm text-gray-500 font-medium">
                    {selectedArticle.author && (
                      <div className="flex items-center gap-2">
                        <UserCheck size={18} className="text-brand-secondary" />
                        {selectedArticle.author}
                      </div>
                    )}
                    {selectedArticle.readTime && (
                      <div className="flex items-center gap-2">
                        <Clock size={18} className="text-brand-secondary" />
                        {selectedArticle.readTime}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Clock size={18} className="text-brand-secondary" />
                      {new Date(selectedArticle.createdAt || '').toLocaleDateString('pt-BR')}
                    </div>
                  </div>

                  <div className="prose prose-lg max-w-none prose-headings:text-brand-tertiary prose-a:text-brand-secondary">
                    <p className="text-xl font-medium text-gray-900 mb-10 italic border-l-4 border-brand-primary pl-6 leading-relaxed">
                      {selectedArticle.excerpt}
                    </p>
                    
                    {selectedArticle.content ? (
                      <Markdown>{selectedArticle.content}</Markdown>
                    ) : (
                      <div className="space-y-6 text-gray-600">
                        <p>
                          Este é um conteúdo exclusivo da plataforma SECABUCHO. Aqui você encontrará informações detalhadas sobre como melhorar sua saúde e bem-estar.
                        </p>
                        <p>
                          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Article Navigation Footer */}
                  <div className="mt-16 pt-8 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-6">
                    {prevArticle ? (
                      <button 
                        onClick={() => setSelectedArticle(prevArticle)}
                        className="flex items-center gap-4 group text-left w-full sm:w-1/2"
                      >
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 group-hover:bg-brand-primary group-hover:text-brand-tertiary transition-all flex-shrink-0">
                          <ChevronLeft size={24} />
                        </div>
                        <div className="overflow-hidden">
                          <div className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Anterior</div>
                          <div className="font-bold text-gray-900 group-hover:text-brand-secondary transition-colors truncate">{prevArticle.title}</div>
                        </div>
                      </button>
                    ) : <div className="hidden sm:block sm:w-1/2" />}

                    {nextArticle ? (
                      <button 
                        onClick={() => setSelectedArticle(nextArticle)}
                        className="flex items-center justify-end gap-4 group text-right w-full sm:w-1/2"
                      >
                        <div className="overflow-hidden">
                          <div className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Próximo</div>
                          <div className="font-bold text-gray-900 group-hover:text-brand-secondary transition-colors truncate">{nextArticle.title}</div>
                        </div>
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 group-hover:bg-brand-primary group-hover:text-brand-tertiary transition-all flex-shrink-0">
                          <ChevronRight size={24} />
                        </div>
                      </button>
                    ) : <div className="hidden sm:block sm:w-1/2" />}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
