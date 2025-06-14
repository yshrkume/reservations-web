'use client';

import { useState, useEffect } from 'react';
import ReservationManagement from './ReservationManagement';
import AdminDashboard from './AdminDashboard';
import { API_BASE_URL } from '../../lib/config';

interface TimeSlot {
  time: string;
  available: boolean;
  availableSeats?: number;
  maxCapacity?: number;
}

interface DaySchedule {
  date: string;
  slots: TimeSlot[];
}

interface Reservation {
  id?: string;
  date: string;
  time: string;
  timeSlot?: number;
  name: string;
  phone: string;
  guests: number;
  partySize?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function ReservationCalendar() {
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<{date: string, time: string} | null>(null);
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [reservationData, setReservationData] = useState<Partial<Reservation>>({});
  const [showManageReservations, setShowManageReservations] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

  const generateTimeSlots = (): string[] => {
    const slots: string[] = [];
    // Business hours: 18:00-27:45 JST (extended hours with 27:00 last order)
    // 15-min intervals for 40 slots (slots 0-39)
    for (let hour = 18; hour <= 27; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        if (hour === 27 && minute > 45) break; // Stop at 27:45
        const displayHour = hour >= 24 ? hour - 24 : hour;
        const timeString = `${displayHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    return slots;
  };

  // Calculate maximum bookable seats for a 3-hour reservation starting from a given slot
  const calculateMaxBookableSeats = (startSlot: number, availableSlots: any[]): number => {
    const maxSlot = 39;
    let minAvailableSeats = 6; // Start with max capacity
    
    // Calculate which slots would be occupied by a 3-hour reservation
    const occupiedSlots = [];
    if (startSlot <= 27) {
      // Regular hours: 3 hours (12 slots) but don't exceed maxSlot
      for (let i = 0; i < 12; i++) {
        const slot = startSlot + i;
        if (slot <= maxSlot) {
          occupiedSlots.push(slot);
        }
      }
    } else {
      // Late night hours (25:00+): reserve until 28:00 (slot 39)
      for (let slot = startSlot; slot <= maxSlot; slot++) {
        occupiedSlots.push(slot);
      }
    }
    
    // Find the minimum available seats across all occupied slots
    for (const slot of occupiedSlots) {
      const slotData = availableSlots.find((s: any) => s.slot === slot);
      if (slotData) {
        minAvailableSeats = Math.min(minAvailableSeats, slotData.availableSeats);
      } else {
        // If any slot is completely unavailable, this time slot can't be booked
        return 0;
      }
    }
    
    return minAvailableSeats;
  };

  const generateDateRange = (): string[] => {
    const dates: string[] = [];
    const startDate = new Date('2025-06-20');
    const endDate = new Date('2025-07-04');
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  const fetchAvailability = async () => {
    try {
      const dates = generateDateRange();
      const startDate = dates[0];
      const endDate = dates[dates.length - 1];
      
      // Try batch endpoint first for performance
      try {
        const response = await fetch(`${API_BASE_URL}/reservations/availability/batch?startDate=${startDate}&endDate=${endDate}`);
        const data = await response.json();
        
        if (data.availability && Object.keys(data.availability).length > 0) {
          const availabilityData: {[key: string]: {[key: string]: {available: boolean, availableSeats?: number, maxCapacity?: number}}} = {};
          const timeSlots = generateTimeSlots();
          
          // Process each expected date, looking for it in the API response
          dates.forEach(expectedDate => {
            availabilityData[expectedDate] = {};
            
            // Find matching date in API response (handle timezone offset)
            const apiDateKeys = Object.keys(data.availability);
            let matchingApiDate = apiDateKeys.find(apiDate => apiDate === expectedDate);
            
            if (!matchingApiDate) {
              // Try finding with ±1 day offset for timezone issues
              const dayBefore = new Date(expectedDate);
              dayBefore.setDate(dayBefore.getDate() - 1);
              const dayAfter = new Date(expectedDate);
              dayAfter.setDate(dayAfter.getDate() + 1);
              
              matchingApiDate = apiDateKeys.find(apiDate => 
                apiDate === dayBefore.toISOString().split('T')[0] ||
                apiDate === dayAfter.toISOString().split('T')[0]
              );
            }
            
            const dayData = matchingApiDate ? data.availability[matchingApiDate] : null;
            
            if (dayData && dayData.availableSlots) {
              timeSlots.forEach((timeString, index) => {
                // Calculate maximum bookable seats for 3-hour duration starting from this slot
                const maxAvailableFor3Hours = calculateMaxBookableSeats(index, dayData.availableSlots);
                availabilityData[expectedDate][timeString] = {
                  available: maxAvailableFor3Hours > 0,
                  availableSeats: maxAvailableFor3Hours,
                  maxCapacity: 6
                };
              });
            } else {
              // Fallback: fetch individual date if no batch data
              throw new Error(`No data for date ${expectedDate}`);
            }
          });
          
          return availabilityData;
        }
      } catch (batchError) {
        console.warn('Batch API failed, falling back to individual requests:', batchError);
      }
      
      // Fallback: Use individual API calls
      const availabilityData: {[key: string]: {[key: string]: {available: boolean, availableSeats?: number, maxCapacity?: number}}} = {};
      
      for (const date of dates) {
        try {
          const response = await fetch(`${API_BASE_URL}/reservations/availability/${date}`);
          const data = await response.json();
          
          if (data.availableSlots) {
            const timeSlots = generateTimeSlots();
            availabilityData[date] = {};
            
            timeSlots.forEach((timeString, index) => {
              // Calculate maximum bookable seats for 3-hour duration starting from this slot
              const maxAvailableFor3Hours = calculateMaxBookableSeats(index, data.availableSlots);
              availabilityData[date][timeString] = {
                available: maxAvailableFor3Hours > 0,
                availableSeats: maxAvailableFor3Hours,
                maxCapacity: 6
              };
            });
          }
        } catch (dateError) {
          console.error(`Failed to fetch availability for ${date}:`, dateError);
          // Mark all slots as unavailable for this date
          const timeSlots = generateTimeSlots();
          availabilityData[date] = {};
          timeSlots.forEach((timeString) => {
            availabilityData[date][timeString] = {
              available: false,
              availableSeats: 0,
              maxCapacity: 6
            };
          });
        }
      }
      
      return availabilityData;
    } catch (error) {
      console.error('Failed to fetch availability:', error);
      return {};
    }
  };

  useEffect(() => {
    const initializeSchedule = async () => {
      const dates = generateDateRange();
      const timeSlots = generateTimeSlots();
      const availabilityData = await fetchAvailability();

      const scheduleData: DaySchedule[] = dates.map(date => ({
        date,
        slots: timeSlots.map(time => {
          const slotData = availabilityData[date]?.[time];
          return {
            time,
            available: slotData?.available !== false,
            availableSeats: slotData?.availableSeats,
            maxCapacity: slotData?.maxCapacity
          };
        })
      }));

      setSchedule(scheduleData);
      setLoading(false);
    };

    initializeSchedule();
  }, []);

  const refreshSchedule = async () => {
    const dates = generateDateRange();
    const timeSlots = generateTimeSlots();
    const availabilityData = await fetchAvailability();
    const scheduleData: DaySchedule[] = dates.map(date => ({
      date,
      slots: timeSlots.map(time => {
        const slotData = availabilityData[date]?.[time];
        return {
          time,
          available: slotData?.available !== false,
          availableSeats: slotData?.availableSeats,
          maxCapacity: slotData?.maxCapacity
        };
      })
    }));
    setSchedule(scheduleData);
  };

  const refreshSingleDate = async (targetDate: string) => {
    try {
      // Force individual API call for immediate accuracy
      const response = await fetch(`${API_BASE_URL}/reservations/availability/${targetDate}`);
      const data = await response.json();
      
      if (data.availableSlots) {
        const timeSlots = generateTimeSlots();
        const updatedSlots = timeSlots.map((timeString, index) => {
          // Calculate maximum bookable seats for 3-hour duration starting from this slot
          const maxAvailableFor3Hours = calculateMaxBookableSeats(index, data.availableSlots);
          return {
            time: timeString,
            available: maxAvailableFor3Hours > 0,
            availableSeats: maxAvailableFor3Hours,
            maxCapacity: 6
          };
        });

        // Update only the specific date in schedule
        setSchedule(prevSchedule => 
          prevSchedule.map(day => 
            day.date === targetDate 
              ? { ...day, slots: updatedSlots }
              : day
          )
        );
      }
    } catch (error) {
      console.error(`Failed to refresh date ${targetDate}:`, error);
      // Fall back to full refresh
      await refreshSchedule();
    }
  };

  const handleSlotClick = (date: string, time: string, available: boolean) => {
    if (available) {
      setSelectedSlot({ date, time });
      setReservationData({ date, time, guests: 1 });
      setShowReservationForm(true);
    }
  };

  const convertTimeToSlot = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    const adjustedHours = hours < 18 ? hours + 24 : hours;
    return ((adjustedHours - 18) * 4) + (minutes / 15);
  };

  const handleReservationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    
    try {
      const timeSlot = convertTimeToSlot(selectedSlot.time);
      const requestData = {
        date: selectedSlot.date,
        timeSlot,
        partySize: reservationData.guests,
        name: reservationData.name,
        phone: reservationData.phone
      };
      
      const response = await fetch(`${API_BASE_URL}/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });
      
      if (response.ok) {
        alert('予約が完了しました！');
        setShowReservationForm(false);
        setSelectedSlot(null);
        // Refresh only the affected date for immediate update
        await refreshSingleDate(selectedSlot.date);
      } else {
        const errorData = await response.json();
        alert(`予約に失敗しました: ${errorData.message || errorData.error || '不明なエラー'}`);
      }
    } catch (error) {
      console.error('予約に失敗しました:', error);
      alert('予約に失敗しました。再度お試しください。');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-amber-200 border-t-amber-500 mx-auto mb-6 shadow-lg"></div>
            <div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-transparent border-r-amber-300 animate-pulse mx-auto"></div>
          </div>
          <p className="text-amber-100 font-medium text-lg">読み込み中...</p>
          <div className="mt-2 w-24 h-1 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full mx-auto animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900/95 to-gray-900/95 backdrop-blur-md shadow-2xl border-b border-amber-500/20">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent">義田鮨予約フォーム</h1>
              <p className="mt-2 text-sm sm:text-base text-amber-200 font-medium">営業時間: 18:00-28:00</p>
            </div>
            <div className="flex items-center space-x-4 sm:space-x-6">
              <button
                onClick={() => setShowManageReservations(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 text-black rounded-2xl font-bold text-sm hover:from-amber-500 hover:to-yellow-500 transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                予約管理
              </button>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full shadow-lg ring-2 ring-amber-300"></div>
                <span className="text-sm sm:text-base text-amber-200 font-medium">空席</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-r from-gray-600 to-slate-700 rounded-full shadow-lg"></div>
                <span className="text-sm sm:text-base text-amber-200 font-medium">満席</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6 sm:py-12">
        <div className="bg-gradient-to-br from-slate-800/90 to-gray-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-amber-500/20 overflow-hidden">
          {/* Calendar Header */}
          <div className="bg-gradient-to-r from-slate-800/50 to-gray-800/50 border-b border-amber-500/30 px-4 sm:px-8 py-6 sm:py-8">
            <h2 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">予約カレンダー</h2>
            <p className="text-sm sm:text-base text-amber-200 mt-2 font-medium">空席をタップして予約してください</p>
          </div>

          {/* Calendar Grid */}
          <div className="overflow-x-auto scrollbar-hide">
            <div className="inline-block min-w-full">
              <table className="min-w-full divide-y divide-amber-600/30">
                <thead className="bg-gradient-to-r from-slate-800 to-gray-800">
                  <tr>
                    <th className="sticky left-0 z-20 bg-gradient-to-r from-slate-800 to-gray-800 px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-amber-300 uppercase tracking-wider border-r border-amber-600/30 w-20 sm:w-24 min-w-20 sm:min-w-24">
                      時間
                    </th>
                    {schedule.map((day) => {
                      const date = new Date(day.date);
                      const today = new Date();
                      const isToday = date.toDateString() === today.toDateString();
                      return (
                        <th key={day.date} className="px-2 sm:px-4 py-3 sm:py-4 text-center text-xs font-bold text-amber-300 uppercase tracking-wider border-r border-amber-600/30 last:border-r-0 w-16 sm:w-20 min-w-16 sm:min-w-20">
                          <div className={`${isToday ? 'text-amber-400 font-black bg-gradient-to-r from-amber-900/50 to-yellow-900/50 rounded-lg px-2 py-1 border border-amber-500/30' : ''}`}>
                            <div className="text-xs sm:text-sm font-bold">
                              {date.getMonth() + 1}/{date.getDate()}({date.toLocaleDateString('ja-JP', { weekday: 'short' })})
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="bg-gradient-to-br from-slate-900/20 to-gray-900/20 divide-y divide-amber-600/20">
                  {schedule.length > 0 && schedule[0].slots.map((_, slotIndex) => {
                    const timeSlot = schedule[0].slots[slotIndex];
                    
                    return (
                      <tr key={slotIndex} className="hover:bg-gradient-to-r hover:from-amber-900/10 hover:to-yellow-900/10 transition-all duration-200">
                        <td className="sticky left-0 z-10 bg-gradient-to-r from-slate-800/95 to-gray-800/95 backdrop-blur-sm px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm sm:text-base font-semibold border-r border-amber-600/30 w-20 sm:w-24 min-w-20 sm:min-w-24 shadow-sm">
                          <div className="flex items-center text-amber-200">
                            <span className="font-mono text-xs sm:text-sm">{timeSlot.time}</span>
                          </div>
                        </td>
                        {schedule.map((day) => {
                          const slot = day.slots[slotIndex];
                          const isSelected = selectedSlot?.date === day.date && selectedSlot?.time === slot.time;
                          return (
                            <td key={`${day.date}-${slotIndex}`} className="px-1 sm:px-2 py-3 sm:py-4 whitespace-nowrap text-center border-r border-amber-600/20 last:border-r-0 w-16 sm:w-20">
                              <button
                                onClick={() => handleSlotClick(day.date, slot.time, slot.available)}
                                disabled={!slot.available}
                                className={`
                                  w-11 h-7 sm:w-12 sm:h-8 rounded-xl text-xs font-bold transition-all duration-300 transform active:scale-95 sm:hover:scale-105 touch-manipulation flex items-center justify-center
                                  ${slot.available 
                                    ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-black hover:from-amber-400 hover:to-yellow-500 cursor-pointer shadow-lg hover:shadow-xl ring-2 ring-amber-400/50 hover:ring-amber-300' 
                                    : 'bg-gradient-to-r from-slate-600 to-gray-700 text-slate-400 cursor-not-allowed shadow-sm'
                                  }
                                  ${isSelected ? 'ring-4 ring-amber-400 ring-offset-2 bg-gradient-to-r from-amber-600 to-yellow-700' : ''}
                                `}
                                title={slot.available ? `残り${slot.availableSeats || 0}席` : '満席'}
                              >
                                {slot.available ? (
                                  isSelected ? '✓' : `残${slot.availableSeats || 0}`
                                ) : '×'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Reservation Modal */}
      {showReservationForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-slate-900/95 to-gray-900/95 backdrop-blur-xl rounded-3xl shadow-2xl max-w-md w-full max-h-screen overflow-y-auto border border-amber-500/20 animate-in slide-in-from-bottom duration-500">
            <div className="px-6 sm:px-8 py-6 sm:py-8 border-b border-amber-600/30 bg-gradient-to-r from-slate-800/50 to-gray-800/50">
              <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">予約確認</h3>
              <p className="text-sm sm:text-base text-amber-200 mt-2 font-medium">
                {selectedSlot && new Date(selectedSlot.date).toLocaleDateString('ja-JP', { 
                  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' 
                })} {selectedSlot?.time}
              </p>
            </div>
            <form onSubmit={handleReservationSubmit} className="px-6 sm:px-8 py-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-amber-200 mb-3">お名前</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-4 border-2 border-amber-600/30 rounded-2xl focus:outline-none focus:ring-4 focus:ring-amber-500/50 focus:border-amber-400 text-base font-semibold text-amber-100 bg-slate-800/90 backdrop-blur-sm transition-all duration-200 placeholder:text-amber-500/30"
                  value={reservationData.name || ''}
                  onChange={(e) => setReservationData({...reservationData, name: e.target.value})}
                  placeholder="山田太郎"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-amber-200 mb-3">電話番号</label>
                <input
                  type="tel"
                  required
                  className="w-full px-4 py-4 border-2 border-amber-600/30 rounded-2xl focus:outline-none focus:ring-4 focus:ring-amber-500/50 focus:border-amber-400 text-base font-semibold text-amber-100 bg-slate-800/90 backdrop-blur-sm transition-all duration-200 placeholder:text-amber-500/30"
                  value={reservationData.phone || ''}
                  onChange={(e) => setReservationData({...reservationData, phone: e.target.value})}
                  placeholder="090-1234-5678"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-amber-200 mb-3">人数</label>
                <select
                  className="w-full px-4 py-4 border-2 border-amber-600/30 rounded-2xl focus:outline-none focus:ring-4 focus:ring-amber-500/50 focus:border-amber-400 text-base font-semibold text-amber-100 bg-slate-800/90 backdrop-blur-sm transition-all duration-200 placeholder:text-amber-500/30"
                  value={reservationData.guests || 1}
                  onChange={(e) => setReservationData({...reservationData, guests: parseInt(e.target.value)})}
                >
                  {[1,2,3,4,5,6].map(num => (
                    <option key={num} value={num}>{num}名</option>
                  ))}
                </select>
              </div>
              
              {/* Notice Section */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-400 p-4 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="text-lg">📸</span>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-bold text-amber-800 mb-2">【ご予約前にご確認ください】</h4>
                    <div className="text-xs text-amber-700 space-y-2 leading-relaxed">
                      <p>
                        プレオープン期間中は、店舗の雰囲気や様子を撮影するため、店内にカメラが入る可能性があります。<br />
                        撮影した映像・写真は、SNSやYouTube、今後の広報活動等に使用させていただく可能性がございます。
                      </p>
                      <p>
                        ご来店いただいたお客様が映り込む場合もございますので、予めご了承のうえご予約をお願いいたします。<br />
                        <span className="font-medium">※映りたくない方は、当日スタッフまでお気軽にお声かけください。できる限り配慮させていただきます。</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-4 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowReservationForm(false);
                    setSelectedSlot(null);
                  }}
                  className="flex-1 px-6 py-4 text-base font-bold text-amber-200 bg-gradient-to-r from-slate-700 to-gray-700 hover:from-slate-600 hover:to-gray-600 rounded-2xl transition-all duration-200 transform active:scale-95 touch-manipulation shadow-lg border border-amber-600/30"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-4 text-base font-bold text-black bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 rounded-2xl transition-all duration-200 transform active:scale-95 touch-manipulation shadow-lg hover:shadow-xl"
                >
                  予約する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer with subtle admin access */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6">
        <div className="text-center">
          <button
            onClick={() => setShowAdminDashboard(true)}
            className="text-xs text-amber-600/50 hover:text-amber-400 transition-colors duration-200 px-2 py-1 rounded opacity-50 hover:opacity-100"
          >
            管理者
          </button>
        </div>
      </div>
      
      <ReservationManagement 
        showModal={showManageReservations} 
        onClose={() => setShowManageReservations(false)}
        onReservationUpdate={refreshSchedule}
      />
      
      <AdminDashboard 
        showModal={showAdminDashboard} 
        onClose={() => setShowAdminDashboard(false)} 
      />
    </div>
  );
}