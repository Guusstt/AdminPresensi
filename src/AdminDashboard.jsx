import React, { useState, useEffect } from "react";
import {
  Calendar,
  Download,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  LogOut,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";

// Helper format tanggal YYYY-MM-DD
const formatToLocalDateString = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function AdminDashboard() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [presences, setPresences] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    formatToLocalDateString(new Date())
  );
  const [selectedType, setSelectedType] = useState("all");
  const [selectedUser, setSelectedUser] = useState("all");

  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session, selectedMonth, selectedYear]); // Tambahkan dependensi agar rekap bulanan ikut ter-update

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      setLoginError(authError.message);
      setLoggingIn(false);
      return;
    }

    if (authData.user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      if (profileError) {
        setLoginError("Gagal memeriksa peran pengguna. Coba lagi.");
        await supabase.auth.signOut();
      } else if (profile && profile.role === "admin") {
        setSession(authData.session);
      } else {
        setLoginError("Akses ditolak. Akun ini bukan admin.");
        await supabase.auth.signOut();
      }
    } else {
      setLoginError("Terjadi kesalahan, pengguna tidak ditemukan.");
      await supabase.auth.signOut();
    }
    setLoggingIn(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const fetchData = async () => {
    setLoading(true);
    const { data: presencesData, error: presencesError } = await supabase
      .from("presences")
      .select("*")
      .order("created_at", { ascending: false });

    if (presencesError) {
      console.error("Error fetching presences:", presencesError);
      setLoading(false);
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from("user_details")
      .select("id, name, email");

    if (profilesError) {
      console.error("Error fetching user details:", profilesError);
      setLoading(false);
      return;
    }

    if (presencesData && profilesData) {
      const profilesMap = new Map(
        profilesData.map((profile) => [profile.id, profile])
      );
      const mergedData = presencesData.map((presence) => ({
        ...presence,
        profiles: profilesMap.get(presence.user_id) || null,
      }));
      setPresences(mergedData);
    } else {
      setPresences([]);
    }

    setUsers(profilesData || []);
    setLoading(false);
  };

  const formatDateTime = (d) =>
    new Date(d).toLocaleString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  const isPresenceValid = (presence) => {
    const presenceDate = formatToLocalDateString(presence.created_at);
    const userId = presence.user_id;

    const sameDayPresences = presences.filter(
      (p) =>
        p.user_id === userId &&
        formatToLocalDateString(p.created_at) === presenceDate
    );

    const hasMorning = sameDayPresences.some(
      (p) => p.presence_type === "morning"
    );
    const hasAfternoon = sameDayPresences.some(
      (p) => p.presence_type === "afternoon"
    );

    return hasMorning && hasAfternoon;
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const exportToExcel = () => {
    const filtered = getFilteredPresences();
    const exportData = filtered.map((p) => ({
      Tanggal: formatDate(p.created_at),
      Waktu: new Date(p.created_at).toLocaleTimeString("id-ID"),
      "Nama Guru": p.profiles?.name || "N/A",
      Email: p.profiles?.email || "N/A",
      "Jenis Presensi": p.presence_label,
      Latitude: p.latitude,
      Longitude: p.longitude,
      "Jarak (meter)": p.distance ?? "N/A",
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presensi Guru");
    const fileName = `presensi-guru-${selectedDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const exportMonthlyRecapToExcel = () => {
    const recap = getMonthlyRecap();
    if (recap.length === 0) {
      alert("Tidak ada data rekap untuk bulan ini.");
      return;
    }

    const exportData = recap.map((r) => ({
      "Nama Guru": r.user?.name || "N/A",
      Email: r.user?.email || "N/A",
      "Total Presensi": r.count,
      Bulan: selectedMonth,
      Tahun: selectedYear,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Presensi Bulanan");
    const fileName = `rekap-presensi-bulanan-${selectedMonth}-${selectedYear}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const getFilteredPresences = () =>
    presences.filter((p) => {
      const presenceDate = formatToLocalDateString(p.created_at);
      const matchDate = selectedDate === "" || presenceDate === selectedDate;
      const matchType =
        selectedType === "all" || p.presence_type === selectedType;
      const matchUser = selectedUser === "all" || p.user_id === selectedUser;
      const userName = p.profiles?.name || "";
      const userEmail = p.profiles?.email || "";
      const matchSearch =
        searchTerm === "" ||
        userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        userEmail.toLowerCase().includes(searchTerm.toLowerCase());
      return matchDate && matchType && matchUser && matchSearch;
    });

  const getStats = () => {
    const todayStr = formatToLocalDateString(new Date());
    const todayP = presences.filter(
      (p) => formatToLocalDateString(p.created_at) === todayStr
    );
    const uniq = new Set(todayP.map((p) => p.user_id));
    return {
      totalToday: todayP.length,
      uniqueUsers: uniq.size,
      totalUsers: users.length,
    };
  };

  const getMonthlyRecap = () => {
    const recapMap = new Map();
    presences.forEach((p) => {
      const date = new Date(p.created_at);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      if (month === Number(selectedMonth) && year === Number(selectedYear)) {
        const userId = p.user_id;
        if (!recapMap.has(userId)) {
          recapMap.set(userId, { user: p.profiles, count: 1 });
        } else {
          recapMap.get(userId).count += 1;
        }
      }
    });
    return Array.from(recapMap.values()).sort((a, b) => b.count - a.count);
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-md">
          <div className="text-center space-y-4">
            <Users className="w-16 h-16 text-white bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-4 mx-auto" />
            <h1 className="text-2xl font-bold text-gray-900">Admin Login</h1>
            <p className="text-gray-600">Masuk ke sistem presensi guru</p>
          </div>
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black bg-white"
              required
            />
            <input
              type="password"
              placeholder="Kata sandi"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black bg-white"
              required
            />
            {loginError && (
              <p className="text-sm text-red-600 text-center">{loginError}</p>
            )}
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loggingIn ? "Memproses..." : "Masuk"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const stats = getStats();
  const filteredPresences = getFilteredPresences();
  const monthlyRecap = getMonthlyRecap();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center py-4 gap-4">
            <div className="flex items-center space-x-4">
              <Users className="w-12 h-12 text-white bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-3" />
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                  Admin Dashboard
                </h1>
                <p className="text-sm text-gray-600">Sistem Presensi Guru</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors w-full sm:w-auto justify-center"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard
            title="Presensi Hari Ini"
            value={stats.totalToday}
            icon={<Clock />}
            color="blue"
          />
          <StatCard
            title="Guru Hadir Hari Ini"
            value={stats.uniqueUsers}
            icon={<Users />}
            color="green"
          />
          <StatCard
            title="Total Guru Terdaftar"
            value={stats.totalUsers}
            icon={<Users />}
            color="purple"
          />
        </div>

        {/* Filters and Actions */}
        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex flex-col md:flex-row flex-wrap items-center gap-4 w-full">
              {/* Search */}
              <div className="relative w-full md:w-auto md:flex-grow">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Cari nama atau email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Date Filter */}
              <div className="w-full md:w-auto">
                <label className="text-sm font-medium text-gray-600 sr-only">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Teacher Filter */}
              <div className="w-full md:w-auto">
                <label className="text-sm font-medium text-gray-600 sr-only">
                  Guru
                </label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Semua Guru</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-shrink-0 gap-3 w-full lg:w-auto">
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                <span>Refresh</span>
              </button>
              <button
                onClick={exportToExcel}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export Harian</span>
              </button>
            </div>
          </div>
        </div>

        {/* Daily Presence Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-4 md:p-6 border-b">
            <h2 className="text-lg md:text-xl font-bold text-gray-900">
              Data Presensi Harian ({filteredPresences.length} data)
            </h2>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-12 flex justify-center items-center gap-2">
                <RefreshCw className="animate-spin text-blue-500 w-8 h-8" />
                <span className="text-gray-600">Memuat data...</span>
              </div>
            ) : filteredPresences.length === 0 ? (
              <div className="py-12 text-center">
                <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  Tidak ada data presensi yang ditemukan.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Guru
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Waktu
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Jenis
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Lokasi & Jarak
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPresences.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {p.profiles?.name || "N/A"}
                        </div>
                        <div className="text-gray-500">
                          {p.profiles?.email || "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                        {p.created_at ? formatDateTime(p.created_at) : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            p.presence_type === "morning"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {p.presence_label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        <div>Lat: {p.latitude?.toFixed(5) || "N/A"}</div>
                        <div>Lng: {p.longitude?.toFixed(5) || "N/A"}</div>
                        {p.distance != null && (
                          <div className="text-xs text-blue-500 font-semibold">
                            Jarak: {p.distance} meter
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isPresenceValid(p) ? (
                          <span className="flex items-center text-green-700">
                            <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                            Valid
                          </span>
                        ) : (
                          <span className="flex items-center text-red-700">
                            <XCircle className="w-4 h-4 mr-1 text-red-500" />
                            Tidak Valid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Monthly Recap Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mt-6">
          <div className="p-4 md:p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">
                Rekap Presensi Bulanan
              </h2>
              <p className="text-sm text-gray-500">
                Menampilkan data untuk bulan dan tahun yang dipilih
              </p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString("id-ID", { month: "long" })}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500"
                placeholder="Tahun"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Peringkat
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Guru
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total Presensi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {monthlyRecap.length === 0 ? (
                  <tr>
                    <td
                      colSpan="3"
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      Tidak ada data rekap untuk bulan ini.
                    </td>
                  </tr>
                ) : (
                  monthlyRecap.map((r, index) => (
                    <tr key={r.user?.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-700">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {r.user?.name || "N/A"}
                        </div>
                        <div className="text-gray-500">
                          {r.user?.email || "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-lg text-blue-600">
                        {r.count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 md:p-6 border-t flex justify-end">
            <button
              onClick={exportMonthlyRecapToExcel}
              disabled={monthlyRecap.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:bg-gray-400 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export Rekap Bulanan</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// Komponen Card Statistik untuk kerapian kode
const StatCard = ({ title, value, icon, color }) => {
  const colors = {
    blue: {
      border: "border-blue-500",
      text: "text-blue-600",
      bg: "bg-blue-100",
    },
    green: {
      border: "border-green-500",
      text: "text-green-600",
      bg: "bg-green-100",
    },
    purple: {
      border: "border-purple-500",
      text: "text-purple-600",
      bg: "bg-purple-100",
    },
  };
  const c = colors[color] || colors.blue;

  return (
    <div
      className={`bg-white rounded-2xl shadow-lg p-5 border-l-4 ${c.border}`}
    >
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-3xl font-bold ${c.text}`}>{value}</p>
        </div>
        <div
          className={`w-12 h-12 flex items-center justify-center rounded-xl p-3 ${c.bg} ${c.text}`}
        >
          {React.cloneElement(icon, { className: "w-6 h-6" })}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
