'use client';

import { useState } from 'react';
import { API_BASE_URL } from '../../lib/config';

interface Reservation {
  id: string;
  date: string;
  timeSlot: number;
  name: string;
  phone: string;
  partySize: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  showModal: boolean;
  onClose: () => void;
  onReservationUpdate?: () => void;
}

export default function ReservationManagement({ showModal, onClose, onReservationUpdate }: Props) {
  const [searchPhone, setSearchPhone] = useState('');
  const [userReservations, setUserReservations] = useState<Reservation[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);

  const authenticateAndSearch = async () => {
    if (!searchPhone.trim()) {
      alert('電話番号を入力してください');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/reservations?phone=${encodeURIComponent(searchPhone)}`);
      if (response.ok) {
        const reservations = await response.json();
        setUserReservations(reservations);
        setIsAuthenticated(true);
      } else if (response.status === 400) {
        alert('電話番号が必要です');
      } else {
        alert('予約の検索に失敗しました');
      }
    } catch (error) {
      console.error('予約の検索に失敗しました:', error);
      alert('予約の検索に失敗しました');
    } finally {
      setLoading(false);
    }
  };


  const deleteReservation = async (id: string) => {
    if (!confirm('この予約を削除しますか？')) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/reservations/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        alert('予約が削除されました');
        authenticateAndSearch(); // Refresh the list
        onReservationUpdate?.(); // Update main calendar
      } else {
        alert('削除に失敗しました');
      }
    } catch (error) {
      console.error('削除に失敗しました:', error);
      alert('削除に失敗しました');
    }
  };

  const handleClose = () => {
    onClose();
    setSearchPhone('');
    setUserReservations([]);
    setIsAuthenticated(false);
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-300">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl max-w-2xl w-full max-h-screen overflow-y-auto border border-white/20 animate-in slide-in-from-bottom duration-500">
        <div className="px-6 sm:px-8 py-6 sm:py-8 border-b border-indigo-100/50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
          <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">予約管理</h3>
          <p className="text-sm sm:text-base text-slate-600 mt-2 font-medium">
            {!isAuthenticated ? '電話番号で認証してあなたの予約を確認' : `${searchPhone} の予約一覧`}
          </p>
        </div>
        
        <div className="px-6 sm:px-8 py-6">
          {!isAuthenticated ? (
            // Authentication Form
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">
                  電話番号（認証用）
                </label>
                <input
                  type="tel"
                  className="w-full px-4 py-4 border-2 border-indigo-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-200 focus:border-indigo-400 text-base font-semibold text-slate-800 bg-white/90 backdrop-blur-sm transition-all duration-200 placeholder:text-slate-400"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  placeholder="090-1234-5678"
                  onKeyPress={(e) => e.key === 'Enter' && authenticateAndSearch()}
                />
              </div>
              
              <div className="text-center space-y-3">
                <button
                  onClick={authenticateAndSearch}
                  disabled={loading}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 transform active:scale-95 shadow-lg disabled:opacity-50"
                >
                  {loading ? '認証中...' : '認証して予約を確認'}
                </button>
                
                <p className="text-xs text-slate-500">
                  🔒 セキュリティのため、登録した電話番号での認証が必要です
                </p>
              </div>
            </div>
          ) : (
            // Reservations List
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-bold text-slate-700">あなたの予約</h4>
                <button
                  onClick={() => setIsAuthenticated(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
                >
                  別の番号で認証
                </button>
              </div>

              {userReservations.length > 0 ? (
                <div className="space-y-4">
                  {userReservations.map((reservation) => {
                    const timeSlot = reservation.timeSlot || 0;
                    const startHour = Math.floor(timeSlot / 4) + 18;
                    const startMin = (timeSlot % 4) * 15;
                    const displayHour = startHour >= 24 ? startHour - 24 : startHour;
                    const timeString = `${displayHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`;
                    const date = new Date(reservation.date).toLocaleDateString('ja-JP', {
                      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
                    });
                    
                    return (
                      <div key={reservation.id} className="bg-gradient-to-r from-white to-slate-50 p-6 rounded-2xl border border-slate-200 shadow-lg">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-3">
                              <h5 className="font-bold text-slate-800 text-lg">{reservation.name}</h5>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                reservation.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                                reservation.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                'bg-slate-100 text-slate-800'
                              }`}>
                                {reservation.status === 'CONFIRMED' ? '確定' : 
                                 reservation.status === 'CANCELLED' ? 'キャンセル済み' : 
                                 reservation.status}
                              </span>
                            </div>
                            
                            <div className="space-y-1 text-slate-600">
                              <p className="flex items-center">
                                <span className="font-semibold mr-2">📅</span>
                                {date}
                              </p>
                              <p className="flex items-center">
                                <span className="font-semibold mr-2">🕐</span>
                                {timeString} JST
                              </p>
                              <p className="flex items-center">
                                <span className="font-semibold mr-2">👥</span>
                                {reservation.partySize}名
                              </p>
                              <p className="flex items-center text-xs text-slate-500 mt-2">
                                <span className="font-semibold mr-2">📝</span>
                                予約ID: {reservation.id.slice(-8)}
                              </p>
                            </div>
                          </div>
                          
                          {reservation.status === 'CONFIRMED' && (
                            <div className="flex flex-col space-y-2 ml-4">
                              <button
                                onClick={() => deleteReservation(reservation.id)}
                                className="px-4 py-2 bg-gradient-to-r from-red-400 to-red-600 text-white rounded-xl font-bold text-sm hover:from-red-500 hover:to-red-700 transition-all duration-200 transform active:scale-95 shadow-lg"
                              >
                                削除
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="mb-4 text-6xl">📅</div>
                  <p className="text-slate-600 text-lg font-medium">この電話番号での予約はありません</p>
                  <p className="text-slate-400 text-sm mt-2">予約を作成してみてください</p>
                </div>
              )}
            </div>
          )}
          
          <div className="flex justify-end mt-8 pt-6 border-t border-slate-200">
            <button
              onClick={handleClose}
              className="px-6 py-4 bg-gradient-to-r from-slate-100 to-gray-200 text-slate-700 rounded-2xl font-bold hover:from-slate-200 hover:to-gray-300 transition-all duration-200 transform active:scale-95 shadow-lg"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}