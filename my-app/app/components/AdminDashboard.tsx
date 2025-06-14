'use client';

import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../lib/config';

interface Reservation {
  id: string;
  name: string;
  phone: string;
  partySize: number;
  date: Date;
  timeSlot: number;
  status: string;
  startTime: string;
  endTime: string;
  duration: string;
  dateString: string;
}

interface HourlyOccupancy {
  occupiedSeats: number;
  availableSeats: number;
  reservations: Array<{
    name: string;
    partySize: number;
    phone: string;
    startTime?: string;
    endTime?: string;
  }>;
}

interface DailySummary {
  date: string;
  totalReservations: number;
  totalGuests: number;
  hourlyOccupancy: { [timeKey: string]: HourlyOccupancy };
}

interface AdminDashboardProps {
  showModal: boolean;
  onClose: () => void;
}

export default function AdminDashboard({ showModal, onClose }: AdminDashboardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [selectedDate, setSelectedDate] = useState('2025-06-25');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateDateRange = (): string[] => {
    const dates: string[] = [];
    const startDate = new Date('2025-06-20');
    const endDate = new Date('2025-07-04');
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (response.ok) {
        setIsAuthenticated(true);
        fetchReservations();
        fetchDailySummary();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'ログインに失敗しました');
      }
    } catch (error) {
      setError('サーバーエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const fetchReservations = async (date?: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          password,
          date: date || selectedDate 
        })
      });

      if (response.ok) {
        const data = await response.json();
        setReservations(data.reservations);
      }
    } catch (error) {
      console.error('予約データの取得に失敗しました:', error);
    }
  };

  const fetchDailySummary = async (date?: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          password,
          date: date || selectedDate 
        })
      });

      if (response.ok) {
        const data = await response.json();
        setDailySummary(data);
      }
    } catch (error) {
      console.error('サマリーデータの取得に失敗しました:', error);
    }
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    if (isAuthenticated) {
      fetchReservations(newDate);
      fetchDailySummary(newDate);
    }
  };

  const handleDeleteReservation = async (reservationId: string) => {
    if (!confirm('この予約を削除しますか？')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/admin/reservations/${reservationId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (response.ok) {
        fetchReservations();
        fetchDailySummary();
      } else {
        alert('削除に失敗しました');
      }
    } catch (error) {
      alert('削除に失敗しました');
    }
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl max-w-6xl w-full max-h-screen overflow-y-auto border border-white/20">
        {!isAuthenticated ? (
          // Login Form
          <div className="px-6 sm:px-8 py-6 sm:py-8">
            <div className="max-w-md mx-auto">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-6">
                管理者ログイン
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">パスワード</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-indigo-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-200 focus:border-indigo-400 text-slate-800 bg-white placeholder:text-slate-400"
                    placeholder="管理者パスワードを入力"
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  />
                </div>
                
                {error && (
                  <div className="text-red-600 text-sm font-medium bg-red-50 px-3 py-2 rounded-lg">
                    {error}
                  </div>
                )}
                
                <div className="flex space-x-3">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-3 text-base font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-gray-200 hover:from-slate-200 hover:to-gray-300 rounded-2xl transition-all duration-200"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="flex-1 px-4 py-3 text-base font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-2xl transition-all duration-200 disabled:opacity-50"
                  >
                    {loading ? 'ログイン中...' : 'ログイン'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Dashboard
          <div>
            {/* Header */}
            <div className="px-6 sm:px-8 py-6 border-b border-indigo-100/50 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  管理者ダッシュボード
                </h2>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-gray-200 hover:from-slate-200 hover:to-gray-300 rounded-xl transition-all duration-200"
                >
                  閉じる
                </button>
              </div>
              
              {/* Date Selector */}
              <div className="mt-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">表示日付</label>
                <select
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="px-4 py-2 border-2 border-indigo-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 text-slate-800 bg-white"
                >
                  {generateDateRange().map(date => (
                    <option key={date} value={date}>
                      {new Date(date).toLocaleDateString('ja-JP', { 
                        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' 
                      })}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="px-6 sm:px-8 py-6 space-y-8">
              {/* Daily Summary */}
              {dailySummary && (
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl p-6 border border-emerald-100">
                  <h3 className="text-lg font-bold text-emerald-800 mb-4">日次サマリー</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-600">{dailySummary.totalReservations}</div>
                      <div className="text-sm text-emerald-700">予約数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-600">{dailySummary.totalGuests}</div>
                      <div className="text-sm text-emerald-700">総来客数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-600">
                        {Math.round((dailySummary.totalGuests / (6 * 10)) * 100)}%
                      </div>
                      <div className="text-sm text-emerald-700">平均稼働率</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Gantt Chart Style Hourly View */}
              {dailySummary && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800">時間別座席状況</h3>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-bold text-slate-700">時間</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-slate-700">座席状況</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-slate-700">予約詳細</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Object.entries(dailySummary.hourlyOccupancy).map(([timeKey, occupancy]) => {
                          const occupancyRate = (occupancy.occupiedSeats / 6) * 100;
                          return (
                            <tr key={timeKey} className="hover:bg-slate-50">
                              <td className="px-4 py-4 font-mono font-bold text-slate-800">{timeKey}</td>
                              <td className="px-4 py-4">
                                <div className="flex items-center space-x-3">
                                  <div className="flex-1 bg-slate-200 rounded-full h-6 overflow-hidden">
                                    <div 
                                      className={`h-full transition-all duration-300 ${
                                        occupancyRate === 100 ? 'bg-red-500' : 
                                        occupancyRate >= 80 ? 'bg-orange-500' : 
                                        occupancyRate >= 50 ? 'bg-yellow-500' : 'bg-green-500'
                                      }`}
                                      style={{ width: `${occupancyRate}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-bold text-slate-700 min-w-16">
                                    {occupancy.occupiedSeats}/6席
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                {occupancy.reservations.length > 0 ? (
                                  <div className="space-y-1">
                                    {occupancy.reservations.map((res, idx) => (
                                      <div key={idx} className="text-sm text-slate-600">
                                        <div className="font-medium">{res.name}様 {res.partySize}名</div>
                                        {res.startTime && res.endTime && (
                                          <div className="text-xs text-slate-500">
                                            {res.startTime} - {res.endTime}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-sm text-slate-400">予約なし</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Reservations List */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50 border-b border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800">予約一覧</h3>
                </div>
                
                {reservations.length === 0 ? (
                  <div className="px-6 py-8 text-center text-slate-500">
                    選択した日付に予約はありません
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-bold text-slate-700">時間</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-slate-700">お客様</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-slate-700">人数</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-slate-700">電話番号</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-slate-700">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reservations.map((reservation) => (
                          <tr key={reservation.id} className="hover:bg-slate-50">
                            <td className="px-4 py-4">
                              <div className="font-mono font-bold text-slate-800">
                                {reservation.startTime} - {reservation.endTime}
                              </div>
                              <div className="text-sm text-slate-500">{reservation.duration}</div>
                            </td>
                            <td className="px-4 py-4 font-semibold text-slate-800">
                              {reservation.name}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-800">
                                {reservation.partySize}名
                              </span>
                            </td>
                            <td className="px-4 py-4 font-mono text-slate-600">
                              {reservation.phone}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <button
                                onClick={() => handleDeleteReservation(reservation.id)}
                                className="px-3 py-1 text-sm font-bold text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors duration-200"
                              >
                                削除
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}