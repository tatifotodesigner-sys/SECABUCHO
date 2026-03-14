/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component } from 'react';
import { 
  Menu, X, ShoppingBag, User as UserIcon, LogIn, LogOut, 
  ChevronRight, Star, CheckCircle, ArrowRight,
  Heart, Zap, Sparkles, ShieldCheck, BookOpen, 
  PlayCircle, FileText, HelpCircle, Save, Settings,
  Dumbbell, Droplets, Coffee, Users, Package, Plus,
  Trash2, Edit, Power, PowerOff, Search, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  category: 'emagrecimento' | 'beleza' | 'saude' | 'fitness';
  benefits: string[];
  status?: 'active' | 'inactive' | 'deleted';
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
  healthGoal?: string;
  targetWeight?: number;
  lossPace?: string;
  skinType?: string;
  beautyConcerns?: string;
  createdAt?: string;
}

interface Article {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  type: 'video' | 'article' | 'guide';
  imageUrl: string;
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
  const [activeTab, setActiveTab] = useState<'users' | 'products' | 'categories'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const fetchProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const dbProductsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      const merged = [...PRODUCTS, ...dbProductsData].filter((p, index, self) => 
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
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    return () => {
      fetchUsers();
      fetchProducts();
      fetchCategories();
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
    if (window.confirm("Tem certeza que deseja excluir permanentemente este usuário? Esta ação não pode ser desfeita.")) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
      }
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const productId = editingProduct.id || doc(collection(db, 'products')).id;
    try {
      const productData = {
        ...editingProduct,
        id: productId,
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

  const handleUpdateProduct = async (id: string, data: Partial<Product>) => {
    try {
      await updateDoc(doc(db, 'products', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${id}`);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este produto permanentemente?")) {
      try {
        // To handle both hardcoded and DB products, we mark as 'deleted' in Firestore
        await setDoc(doc(db, 'products', id), { status: 'deleted' }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
      }
    }
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
    if (window.confirm("Tem certeza que deseja excluir esta categoria?")) {
      try {
        await deleteDoc(doc(db, 'categories', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
      }
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

  if (loading) return <div className="flex justify-center p-20"><Zap className="animate-spin text-brand-secondary" /></div>;

  return (
    <div className="pt-32 pb-32 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h2 className="text-4xl font-extrabold text-brand-tertiary mb-2">Painel Administrativo</h2>
          <p className="text-gray-500">Gestão completa de usuários, permissões e catálogo de produtos.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-2xl">
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
        </div>
      </div>

      <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder={`Buscar ${activeTab === 'users' ? 'usuários' : activeTab === 'products' ? 'produtos' : 'categorias'}...`}
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
            } else {
              setEditingCategory({});
              setIsCategoryModalOpen(true);
            }
          }}
          className="w-full md:w-auto bg-brand-tertiary text-white px-8 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-brand-tertiary/90 transition-all"
        >
          <Plus size={20} />
          {activeTab === 'users' ? 'Novo Usuário' : activeTab === 'products' ? 'Novo Produto' : 'Nova Categoria'}
        </button>
      </div>

      {activeTab === 'users' ? (
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
      ) : activeTab === 'products' ? (
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
                          onClick={() => handleUpdateProduct(p.id, { status: p.status === 'inactive' ? 'active' : 'inactive' })}
                          className="p-2 text-gray-400 hover:text-brand-secondary transition-colors"
                          title={p.status === 'inactive' ? 'Ativar' : 'Desativar'}
                        >
                          {p.status === 'inactive' ? <Power size={18} /> : <PowerOff size={18} />}
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(p.id)}
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
      ) : (
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
    { id: 'education', label: 'Educação', icon: <BookOpen size={20} /> },
  ];

  if (user) {
    items.push({ id: 'dashboard', label: 'Membros', icon: <ShieldCheck size={20} /> });
    if (user.role === 'Master Admin' || user.role === 'Admin') {
      items.push({ id: 'admin', label: 'Admin', icon: <Settings size={20} /> });
    }
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 px-4 py-3 flex justify-around items-center shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      {items.map(item => (
        <button 
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            currentView === item.id ? "text-brand-secondary" : "text-gray-400"
          )}
        >
          {item.icon}
          <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

const Navbar = ({ user, onLogin, onLogout, onNavigate, currentView }: { 
  user: UserProfile | null, 
  onLogin: () => void, 
  onLogout: () => void,
  onNavigate: (view: string) => void,
  currentView: string
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Início', icon: <Zap size={18} /> },
    { id: 'products', label: 'Produtos', icon: <ShoppingBag size={18} /> },
    { id: 'education', label: 'Educação', icon: <BookOpen size={18} /> },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('home')}>
            <div className="w-10 h-10 bg-brand-tertiary rounded-xl flex items-center justify-center text-brand-primary shadow-lg shadow-brand-tertiary/20">
              <Zap size={24} />
            </div>
            <span className="text-2xl font-bold tracking-tighter text-brand-tertiary">SECABUCHO</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map(item => (
              <button 
                key={item.id}
                onClick={() => onNavigate(item.id)} 
                className={cn(
                  "flex items-center gap-2 font-medium transition-colors",
                  currentView === item.id ? "text-brand-secondary" : "text-gray-600 hover:text-brand-secondary"
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
                  currentView === 'admin' ? "text-brand-secondary" : "text-gray-600 hover:text-brand-secondary"
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
                  currentView === 'dashboard' ? "text-brand-secondary" : "text-gray-600 hover:text-brand-secondary"
                )}
              >
                Área de Membros
              </button>
            )}
            
            {user ? (
              <div className="flex items-center gap-4 pl-4 border-l border-gray-200">
                <button 
                  onClick={() => onNavigate('profile')}
                  className="flex items-center gap-2 group"
                >
                  <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-brand-secondary/20 group-hover:border-brand-secondary transition-all" />
                  <span className="text-sm font-semibold text-gray-700 group-hover:text-brand-secondary transition-colors">Perfil</span>
                </button>
                <button onClick={onLogout} className="text-gray-400 hover:text-red-600 transition-colors">
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button 
                onClick={onLogin}
                className="bg-brand-primary text-brand-tertiary px-6 py-2.5 rounded-full font-semibold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 flex items-center gap-2"
              >
                <LogIn size={18} />
                Entrar
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-600">
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
            className="md:hidden bg-white border-b border-gray-100 px-4 py-6 flex flex-col gap-4"
          >
            {navItems.map(item => (
              <button 
                key={item.id}
                onClick={() => { onNavigate(item.id); setIsOpen(false); }} 
                className="text-left text-lg font-medium text-gray-700 flex items-center gap-3"
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
                <button onClick={() => { onLogin(); setIsOpen(false); }} className="w-full bg-brand-primary text-brand-tertiary py-3 rounded-xl font-bold">Entrar</button>
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
        {product.benefits.slice(0, 3).map((benefit, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle size={14} className="text-brand-primary" />
            {benefit}
          </div>
        ))}
      </div>

      <div className="mt-auto">
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-black text-brand-tertiary">{product.price}</span>
          <span className="text-sm text-gray-400 line-through">{product.originalPrice}</span>
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
    setFormData(prev => ({ ...prev, [name]: name === 'age' || name === 'targetWeight' ? Number(value) : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onUpdate(formData);
    setSaving(false);
    alert('Perfil atualizado com sucesso!');
  };

  return (
    <div className="pt-32 pb-20 max-w-4xl mx-auto px-4">
      <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
        <div className="bg-brand-tertiary p-12 text-white relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-8">
            <img src={user.photoURL || ''} alt="" className="w-24 h-24 rounded-3xl border-4 border-white/20 shadow-lg" />
            <div>
              <h2 className="text-3xl font-bold">{user.displayName}</h2>
              <p className="text-brand-primary">{user.email}</p>
            </div>
          </div>
          <Sparkles className="absolute top-10 right-10 text-brand-primary/30 w-32 h-32" />
        </div>

        <form onSubmit={handleSubmit} className="p-12">
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Basic Info */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <UserIcon size={20} className="text-brand-secondary" />
                Informações Básicas
              </h3>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Idade</label>
                <input 
                  type="number" name="age" value={formData.age || ''} onChange={handleChange}
                  className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary transition-all"
                  placeholder="Ex: 25"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Gênero</label>
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

            {/* Health Goals */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Heart size={20} className="text-brand-secondary" />
                Objetivos de Saúde
              </h3>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Objetivo Principal</label>
                <select 
                  name="healthGoal" value={formData.healthGoal || ''} onChange={handleChange}
                  className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary transition-all"
                >
                  <option value="">Selecione</option>
                  <option value="Perda de Peso">Perda de Peso</option>
                  <option value="Ganho de Massa">Ganho de Massa</option>
                  <option value="Manutenção">Manutenção</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Peso Desejado (kg)</label>
                  <input 
                    type="number" name="targetWeight" value={formData.targetWeight || ''} onChange={handleChange}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary transition-all"
                    placeholder="Ex: 70"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Ritmo</label>
                  <select 
                    name="lossPace" value={formData.lossPace || ''} onChange={handleChange}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary transition-all"
                  >
                    <option value="">Selecione</option>
                    <option value="Lento">Lento</option>
                    <option value="Moderado">Moderado</option>
                    <option value="Rápido">Rápido</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Beauty Preferences */}
            <div className="md:col-span-2 space-y-6 pt-8 border-t border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Sparkles size={20} className="text-brand-secondary" />
                Preferências de Beleza
              </h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Pele</label>
                  <select 
                    name="skinType" value={formData.skinType || ''} onChange={handleChange}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary transition-all"
                  >
                    <option value="">Selecione</option>
                    <option value="Seca">Seca</option>
                    <option value="Oleosa">Oleosa</option>
                    <option value="Mista">Mista</option>
                    <option value="Normal">Normal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Preocupações (Cabelo/Pele)</label>
                  <textarea 
                    name="beautyConcerns" value={formData.beautyConcerns || ''} onChange={handleChange}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-secondary transition-all h-24 resize-none"
                    placeholder="Ex: Queda de cabelo, espinhas, manchas..."
                  />
                </div>
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={saving}
            className="w-full bg-brand-primary text-brand-tertiary py-5 rounded-3xl font-bold text-lg shadow-xl shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all flex items-center justify-center gap-3"
          >
            {saving ? "Salvando..." : <><Save size={20} /> Salvar Alterações</>}
          </button>
        </form>
      </div>
    </div>
  );
};

const EducationView = () => {
  const [activeQuiz, setActiveQuiz] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);

  const handleAnswer = (index: number) => {
    if (index === QUIZ_QUESTIONS[currentQuestion].correctAnswer) {
      setQuizScore(prev => (prev || 0) + 1);
    }
    
    if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
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
        <h2 className="text-5xl font-extrabold mb-4">Conteúdo <span className="text-brand-secondary">Educacional</span></h2>
        <p className="text-gray-500 max-w-2xl mx-auto">Aprenda com especialistas e teste seus conhecimentos para uma vida mais saudável.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-12">
        {/* Articles List */}
        <div className="lg:col-span-2 space-y-12">
          {ARTICLES.map(article => (
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
                <p className="text-gray-500 mb-6">{article.excerpt}</p>
                <button className="text-brand-secondary font-bold flex items-center gap-2 hover:gap-3 transition-all">
                  Ler Conteúdo Completo
                  <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          ))}
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

function AppContent() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('home');
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [dbCategories, setDbCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

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

    const categoriesUnsubscribe = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const categoriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setDbCategories(categoriesData);
    });

    return () => {
      unsubscribe();
      productsUnsubscribe();
      categoriesUnsubscribe();
    };
  }, []);

  const allProducts = [...PRODUCTS, ...dbProducts].filter((p, index, self) => 
    index === self.findIndex((t) => t.id === p.id)
  );

  const visibleProducts = allProducts.filter(p => p.status !== 'inactive' && p.status !== 'deleted');
  
  const filteredProducts = selectedCategory === 'all' 
    ? visibleProducts 
    : visibleProducts.filter(p => p.category === selectedCategory);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setCurrentView('dashboard');
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentView('home');
  };

  const handleUpdateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), data);
      setUser(prev => prev ? { ...prev, ...data } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
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
    <div className="min-h-screen bg-white font-sans text-brand-text">
      <Navbar 
        user={user} 
        onLogin={handleLogin} 
        onLogout={handleLogout}
        onNavigate={setCurrentView}
        currentView={currentView}
      />

      <main>
        {currentView === 'admin' && user && (user.role === 'Master Admin' || user.role === 'Admin') && (
          <AdminPanel user={user} />
        )}
        
        {currentView === 'home' && (
          <>
            <section className="relative pt-32 pb-20 overflow-hidden">
              <div className="absolute top-0 right-0 -z-10 w-1/2 h-full bg-brand-secondary/5 rounded-l-[100px]" />
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
              </div>
            </section>
            
            {/* Quick Stats Section */}
            <section className="py-20 bg-gray-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-4 gap-8">
                {[
                  { label: "Clientes Ativos", value: "35k+", icon: <UserIcon /> },
                  { label: "Produtos Validados", value: "12+", icon: <ShieldCheck /> },
                  { label: "Dicas de Saúde", value: "500+", icon: <Zap /> },
                  { label: "Satisfação", value: "99%", icon: <Star /> }
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-8 rounded-3xl shadow-sm flex flex-col items-center text-center">
                    <div className="text-brand-secondary mb-4">{React.cloneElement(stat.icon as React.ReactElement, { size: 24 })}</div>
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
                {filteredProducts.map(p => <ProductCard key={p.id} product={p} />)}
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

        {currentView === 'education' && <EducationView />}

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
                <Dumbbell className="mb-6" size={40} />
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
              {visibleProducts.slice(0, 4).map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}

        {currentView === 'profile' && user && (
          <ProfileView user={user} onUpdate={handleUpdateProfile} />
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
              <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-brand-primary hover:text-brand-tertiary transition-colors cursor-pointer">
                <span className="text-xs font-bold">IG</span>
              </div>
              <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-brand-primary hover:text-brand-tertiary transition-colors cursor-pointer">
                <span className="text-xs font-bold">FB</span>
              </div>
              <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-brand-primary hover:text-brand-tertiary transition-colors cursor-pointer">
                <span className="text-xs font-bold">WA</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-6">Navegação</h4>
            <ul className="space-y-4 text-gray-400">
              <li><button onClick={() => setCurrentView('home')} className="hover:text-brand-primary transition-colors">Início</button></li>
              <li><button onClick={() => setCurrentView('products')} className="hover:text-brand-primary transition-colors">Produtos</button></li>
              <li><button onClick={() => setCurrentView('education')} className="hover:text-brand-primary transition-colors">Educação</button></li>
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
    </div>
  );
}
