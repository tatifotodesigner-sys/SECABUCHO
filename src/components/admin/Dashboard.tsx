import React from 'react';
import { Users, Package, BookOpen, AlertCircle } from 'lucide-react';

interface DashboardProps {
  usersCount: number;
  activeProductsCount: number;
  publishedArticlesCount: number;
  lowStockProducts: any[];
}

export const Dashboard: React.FC<DashboardProps> = ({
  usersCount,
  activeProductsCount,
  publishedArticlesCount,
  lowStockProducts
}) => {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-tertiary/10 flex items-center justify-center text-brand-tertiary">
            <Users size={24} />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-500">Total de Usuários</div>
            <div className="text-3xl font-extrabold text-gray-900">{usersCount}</div>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-secondary/10 flex items-center justify-center text-brand-secondary">
            <Package size={24} />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-500">Produtos Ativos</div>
            <div className="text-3xl font-extrabold text-gray-900">{activeProductsCount}</div>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center text-green-600">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-500">Conteúdos Publicados</div>
            <div className="text-3xl font-extrabold text-gray-900">{publishedArticlesCount}</div>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center text-red-600">
            <AlertCircle size={24} />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-500">Estoque Baixo</div>
            <div className="text-3xl font-extrabold text-gray-900">{lowStockProducts.length}</div>
          </div>
        </div>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-6">
          <h3 className="text-xl font-bold text-red-800 mb-4 flex items-center gap-2">
            <AlertCircle size={24} />
            Atenção: Produtos com Estoque Baixo
          </h3>
          <div className="space-y-3">
            {lowStockProducts.map(p => (
              <div key={p.id} className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3">
                  <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                  <span className="font-bold text-gray-900">{p.name}</span>
                </div>
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold">
                  Restam {p.stock || 0} unidades
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
