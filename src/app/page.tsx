'use client'; // This directive is necessary for client-side functionality in Next.js 13+ App Router

import { useState, useEffect } from 'react';
import axios from 'axios'; // Import axios for making API requests

// Define a simple API instance for protected calls
// In a larger application, this would typically be in a separate file (e.g., src/services/api.ts)
// with full interceptor setup as discussed in previous turns.
const protectedApi = axios.create({
  baseURL: 'http://198.211.105.95:8080', // Base URL for your backend API
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to attach the JWT token to protected requests
protectedApi.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('jwtToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- Interface para la estructura de una Gasto Individual (raw data) ---
// Esta es la estructura que esperamos del endpoint /expenses/detail
// Y la usaremos para /expenses_summary (asumiendo que ahora devuelve raw expenses)
interface RawExpense {
  id: number;
  date: string; // Changed from year/month to date string
  category: { // Changed from expenseCategory to category
    id: number;
    name: string;
  };
  amount: number;
}

// --- Interface para la estructura del Resumen de Gastos (procesado en frontend) ---
// Esta es la estructura que usaremos para mostrar en la tabla de resumen
interface ExpenseSummaryItem {
  expenseCategory: {
    id: number;
    name: string;
  };
  totalAmount: number;
}

// --- Interface para Categorías de Gastos ---
interface ExpenseCategory {
  id: number;
  name: string;
}

// --- Componente Dashboard (Contenido Protegido) ---
const Dashboard = ({ onLogout }: { onLogout: () => void }) => {
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // States for 'Resumen de Gastos' tab
  const [expensesSummary, setExpensesSummary] = useState<ExpenseSummaryItem[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // Current month
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear()); // Current year
  const [loadingExpenses, setLoadingExpenses] = useState<boolean>(false);
  const [expensesError, setExpensesError] = useState<string | null>(null);

  // States for 'Detalle de gastos por categoría' tab
  const [detailExpenses, setDetailExpenses] = useState<RawExpense[]>([]);
  const [detailSelectedMonth, setDetailSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [detailSelectedYear, setDetailSelectedYear] = useState<number>(new Date().getFullYear());
  const [detailSelectedCategoryId, setDetailSelectedCategoryId] = useState<number | ''>(''); // Allow empty string for no selection
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);


  // States for 'Registrar Gastos' tab
  const [newExpenseAmount, setNewExpenseAmount] = useState<number | string>('');
  const [newExpenseCategoryId, setNewExpenseCategoryId] = useState<number | ''>('');
  const [newExpenseDate, setNewExpenseDate] = useState<string>(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [registerExpenseMessage, setRegisterExpenseMessage] = useState<string | null>(null);
  const [registerExpenseLoading, setRegisterExpenseLoading] = useState<boolean>(false);


  // States for 'Categorías de Gastos' tab
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState<boolean>(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [selectedTab, setSelectedTab] = useState<'summary' | 'detail' | 'manage' | 'categories'>('summary'); // New state for tabs

  useEffect(() => {
    // Get user email from localStorage on component mount
    if (typeof window !== 'undefined') {
      setUserEmail(localStorage.getItem('userEmail'));
    }
    // Fetch data for 'Categorías' tab automatically when selected or when 'Detail' tab needs them
    if (selectedTab === 'categories' || selectedTab === 'detail' || selectedTab === 'manage') { // 'manage' tab now also needs categories
      // Only fetch if categories are not already loaded to avoid unnecessary API calls
      if (expenseCategories.length === 0 && !loadingCategories && !categoriesError) {
        fetchExpenseCategories();
      }
    }
    // Note: 'summary' data is now fetched ONLY on button click
  }, [selectedTab]); // Re-fetch if tab changes to categories or detail needs categories

  const fetchExpensesSummary = async () => {
    setLoadingExpenses(true);
    setExpensesError(null);
    setExpensesSummary([]); // Clear previous data

    try {
      // 1. Fetch ALL expenses from the backend (no query parameters for month/year)
      // Assuming /expenses_summary now returns RawExpense[] matching the detail format
      const response = await protectedApi.get<RawExpense[]>('/expenses_summary');

      if (response.status === 200 && Array.isArray(response.data)) {
        const allExpenses: RawExpense[] = response.data;

        // 2. Filter by selected month and year on the frontend
        const filteredExpenses = allExpenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate.getMonth() + 1 === selectedMonth && expenseDate.getFullYear() === selectedYear;
        });

        // 3. Aggregate by category name to get totalAmount
        const aggregatedExpenses = filteredExpenses.reduce((acc, expense) => {
          const categoryName = expense.category.name; // Use 'category.name'
          // Ensure expense.amount is a number before adding, handle potential NaN from backend
          const amountToAdd = typeof expense.amount === 'number' ? expense.amount : 0;

          if (!acc[categoryName]) {
            acc[categoryName] = {
              expenseCategory: {
                id: expense.category.id, // Use 'category.id'
                name: categoryName
              },
              totalAmount: 0
            };
          }
          acc[categoryName].totalAmount += amountToAdd;
          return acc;
        }, {} as { [key: string]: ExpenseSummaryItem }); // Use an index signature for the accumulator type

        // Convert the aggregated object back into an array for rendering
        const summaryArray: ExpenseSummaryItem[] = Object.values(aggregatedExpenses);

        setExpensesSummary(summaryArray);
      } else {
        setExpensesError('Formato de datos de resumen inesperado.');
        console.error('Unexpected response format:', response.data);
      }
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        if (err.response.status === 401) {
          setExpensesError('No autorizado. Por favor, inicia sesión de nuevo.');
          onLogout(); // Force logout if token is invalid/expired
        } else {
          setExpensesError(`Error al cargar el resumen de gastos: ${err.response.data.message || 'Error del servidor.'}`);
        }
      } else {
        setExpensesError('Error al conectar con el servidor para obtener gastos.');
      }
      console.error('Error fetching expenses summary:', err);
    } finally {
      setLoadingExpenses(false);
    }
  };

  const fetchExpenseCategories = async () => {
    setLoadingCategories(true);
    setCategoriesError(null);
    setExpenseCategories([]);

    try {
      const response = await protectedApi.get<ExpenseCategory[]>('/expenses_category');

      if (response.status === 200 && Array.isArray(response.data)) {
        setExpenseCategories(response.data);
      } else {
        setCategoriesError('Formato de datos de categorías inesperado.');
        console.error('Unexpected categories response format:', response.data);
      }
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        if (err.response.status === 401) {
          setCategoriesError('No autorizado. Por favor, inicia sesión de nuevo.');
          onLogout();
        } else {
          setCategoriesError(`Error al cargar categorías: ${err.response.data.message || 'Error del servidor.'}`);
        }
      } else {
        setCategoriesError('Error al conectar con el servidor para obtener categorías.');
      }
      console.error('Error fetching categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchExpenseDetail = async () => {
    setLoadingDetail(true);
    setDetailError(null);
    setDetailExpenses([]);

    if (!detailSelectedCategoryId) {
      setDetailError('Por favor, selecciona una categoría.');
      setLoadingDetail(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        year: detailSelectedYear.toString(),
        month: detailSelectedMonth.toString(),
        categoryId: detailSelectedCategoryId.toString(),
      });

      const response = await protectedApi.get<RawExpense[]>(`/expenses/detail?${params.toString()}`);

      if (response.status === 200 && Array.isArray(response.data)) {
        setDetailExpenses(response.data);
      } else {
        setDetailError('Formato de datos de detalle inesperado.');
        console.error('Unexpected detail response format:', response.data);
      }
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        if (err.response.status === 401) {
          setDetailError('No autorizado. Por favor, inicia sesión de nuevo.');
          onLogout();
        } else {
          setDetailError(`Error al cargar el detalle de gastos: ${err.response.data.message || 'Error del servidor.'}`);
        }
      } else {
        setDetailError('Error al conectar con el servidor para obtener el detalle de gastos.');
      }
      console.error('Error fetching expense detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDeleteExpense = async (expenseId: number) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar el gasto con ID: ${expenseId}?`)) {
      return; // User cancelled the deletion
    }

    setLoadingDetail(true); // Indicate loading for the detail section
    setDetailError(null); // Clear previous errors

    try {
      const response = await protectedApi.delete(`/expenses/${expenseId}`);

      if (response.status === 200) {
        alert(`Gasto con ID ${expenseId} eliminado exitosamente.`); // Use alert for simplicity
        fetchExpenseDetail(); // Re-fetch the detail list to update the UI
      } else {
        setDetailError(`Error al eliminar el gasto: Respuesta inesperada del servidor (Status: ${response.status}).`);
      }
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        if (err.response.status === 401) {
          setDetailError('No autorizado para eliminar. Por favor, inicia sesión de nuevo.');
          onLogout();
        } else {
          setDetailError(`Error al eliminar el gasto: ${err.response.data.message || 'Error del servidor.'}`);
        }
      } else {
        setDetailError('Error de red al intentar eliminar el gasto.');
      }
      console.error('Error deleting expense:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleRegisterNewExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterExpenseMessage(null);
    setRegisterExpenseLoading(true);

    if (!newExpenseAmount || !newExpenseCategoryId || !newExpenseDate) {
      setRegisterExpenseMessage('Por favor, completa todos los campos.');
      setRegisterExpenseLoading(false);
      return;
    }

    // Find the full category object based on selected ID
    const selectedCategory = expenseCategories.find(cat => cat.id === newExpenseCategoryId);
    if (!selectedCategory) {
      setRegisterExpenseMessage('Categoría seleccionada inválida.');
      setRegisterExpenseLoading(false);
      return;
    }

    try {
      // The body structure should match what the backend expects for a new expense.
      // Based on the RawExpense interface, it likely expects 'date', 'category' (object), and 'amount'.
      const expenseData = {
        date: newExpenseDate,
        category: selectedCategory, // Send the full category object if backend expects it
        amount: Number(newExpenseAmount), // Ensure amount is a number
      };

      // Alternative body if backend only expects categoryId:
      // const expenseData = {
      //   date: newExpenseDate,
      //   categoryId: newExpenseCategoryId,
      //   amount: Number(newExpenseAmount),
      // };
      // You might need to experiment with your backend to confirm which one it expects.

      const response = await protectedApi.post('/expenses', expenseData);

      if (response.status === 200 || response.status === 201) { // 200 OK or 201 Created
        setRegisterExpenseMessage('¡Gasto registrado exitosamente!');
        // Clear form fields
        setNewExpenseAmount('');
        setNewExpenseCategoryId('');
        setNewExpenseDate(new Date().toISOString().slice(0, 10)); // Reset to current date
      } else {
        setRegisterExpenseMessage(`Error al registrar gasto: Respuesta inesperada del servidor (Status: ${response.status}).`);
        console.error('Unexpected register expense response:', response.data);
      }
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        if (err.response.status === 401) {
          setRegisterExpenseMessage('No autorizado para registrar. Por favor, inicia sesión de nuevo.');
          onLogout();
        } else {
          setRegisterExpenseMessage(`Error al registrar gasto: ${err.response.data.message || 'Error del servidor.'}`);
        }
      } else {
        setRegisterExpenseMessage('Error de red al intentar registrar el gasto.');
      }
      console.error('Error registering expense:', err);
    } finally {
      setRegisterExpenseLoading(false);
    }
  };


  const tabButtonClass = (tabName: string) =>
    `py-2 px-4 rounded-t-lg font-semibold transition-colors duration-200 ${selectedTab === tabName
      ? 'bg-blue-600 text-white'
      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
    }`;

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-4xl text-center flex flex-col gap-8">
      <h2 className="text-3xl font-bold text-gray-800">Panel de Control</h2>
      <p className="text-lg text-gray-700 mb-4">
        ¡Bienvenido, <span className="font-semibold">{userEmail || 'usuario'}</span>! Has iniciado sesión.
      </p>

      {/* Tabs Navigation */}
      <div className="flex justify-center border-b border-gray-200">
        <button onClick={() => setSelectedTab('summary')} className={tabButtonClass('summary')}>
          Resumen de Gastos
        </button>
        <button onClick={() => setSelectedTab('detail')} className={tabButtonClass('detail')}>
          Detalle por Categoría
        </button>
        <button onClick={() => setSelectedTab('manage')} className={tabButtonClass('manage')}>
          Registrar Gastos
        </button> {/* Changed tab name */}
        <button onClick={() => setSelectedTab('categories')} className={tabButtonClass('categories')}>
          Categorías
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-6 border border-gray-200 rounded-b-md rounded-tr-md bg-gray-50 flex flex-col gap-4">
        {selectedTab === 'summary' && (
          <>
            <h3 className="text-xl font-semibold text-gray-800">Resumen de Gastos por Categoría</h3>

            {/* Controles para seleccionar mes y año */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
              <label htmlFor="month-select" className="text-gray-700">Mes:</label>
              <select
                id="month-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                {[...Array(12).keys()].map((i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString('es-ES', { month: 'long' })}
                  </option>
                ))}
              </select>

              <label htmlFor="year-input" className="text-gray-700">Año:</label>
              <input
                type="number"
                id="year-input"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 w-24"
                min="2000" // Adjust min/max year as needed
                max="2030"
              />
              <button
                onClick={fetchExpensesSummary}
                className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 font-semibold shadow-md"
                disabled={loadingExpenses}
              >
                {loadingExpenses ? 'Cargando...' : 'Ver Resumen'}
              </button>
            </div>

            {/* Mostrar el resumen de gastos */}
            {loadingExpenses ? (
              <p className="text-gray-600">Cargando resumen de gastos...</p>
            ) : expensesError ? (
              <p className="text-red-500">{expensesError}</p>
            ) : expensesSummary.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Gastado</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {expensesSummary.map((item, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.expenseCategory.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          ${item.totalAmount?.toFixed(2)} {/* Use optional chaining for safety */}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600">No hay datos de gastos para el mes seleccionado.</p>
            )}
          </>
        )}

        {selectedTab === 'detail' && (
          <>
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Detalle de Gastos por Categoría</h3>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
              <label htmlFor="detail-month-select" className="text-gray-700">Mes:</label>
              <select
                id="detail-month-select"
                value={detailSelectedMonth}
                onChange={(e) => setDetailSelectedMonth(Number(e.target.value))}
                className="p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                {[...Array(12).keys()].map((i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString('es-ES', { month: 'long' })}
                  </option>
                ))}
              </select>

              <label htmlFor="detail-year-input" className="text-gray-700">Año:</label>
              <input
                type="number"
                id="detail-year-input"
                value={detailSelectedYear}
                onChange={(e) => setDetailSelectedYear(Number(e.target.value))}
                className="p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 w-24"
                min="2000"
                max="2030"
              />

              <label htmlFor="detail-category-select" className="text-gray-700">Categoría:</label>
              <select
                id="detail-category-select"
                value={detailSelectedCategoryId}
                onChange={(e) => setDetailSelectedCategoryId(Number(e.target.value) || '')}
                className="p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecciona una categoría</option>
                {expenseCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button
                onClick={fetchExpenseDetail}
                className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 font-semibold shadow-md"
                disabled={loadingDetail}
              >
                {loadingDetail ? 'Cargando...' : 'Ver Detalle'}
              </button>
            </div>

            {loadingDetail ? (
              <p className="text-gray-600">Cargando detalle de gastos...</p>
            ) : detailError ? (
              <p className="text-red-500">{detailError}</p>
            ) : detailExpenses.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Gasto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th> {/* Changed to Fecha */}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th> {/* New column for actions */}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {detailExpenses.map((expense) => (
                      <tr key={expense.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{expense.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{expense.date}</td> {/* Using date directly */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{expense.category.name}</td> {/* Using category.name */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${expense.amount?.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="text-red-600 hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition duration-150 ease-in-out font-semibold text-sm rounded-md border border-red-600 px-3 py-1 hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600">No hay datos de gastos detallados para los filtros seleccionados.</p>
            )}
          </>
        )}

        {selectedTab === 'manage' && (
          <div className="py-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Registrar Gastos</h3> {/* Changed heading */}
            <form onSubmit={handleRegisterNewExpense} className="space-y-4">
              <div>
                <label htmlFor="newExpenseAmount" className="block text-gray-700 text-sm font-medium mb-2">Monto:</label>
                <input
                  type="number"
                  id="newExpenseAmount"
                  value={newExpenseAmount}
                  onChange={(e) => setNewExpenseAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: 123.45"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label htmlFor="newExpenseCategory" className="block text-gray-700 text-sm font-medium mb-2">Categoría:</label>
                <select
                  id="newExpenseCategory"
                  value={newExpenseCategoryId}
                  onChange={(e) => setNewExpenseCategoryId(Number(e.target.value) || '')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Selecciona una categoría</option>
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="newExpenseDate" className="block text-gray-700 text-sm font-medium mb-2">Fecha:</label>
                <input
                  type="date"
                  id="newExpenseDate"
                  value={newExpenseDate}
                  onChange={(e) => setNewExpenseDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 font-semibold shadow-md"
                disabled={registerExpenseLoading}
              >
                {registerExpenseLoading ? 'Registrando...' : 'Registrar Gasto'}
              </button>
            </form>
            {registerExpenseMessage && (
              <p className={`mt-4 text-sm ${registerExpenseMessage.includes('exitosamente') ? 'text-green-600' : 'text-red-500'}`}>
                {registerExpenseMessage}
              </p>
            )}
          </div>
        )}

        {selectedTab === 'categories' && (
          <div className="py-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Categorías de Gastos</h3>
            {loadingCategories ? (
              <p className="text-gray-600">Cargando categorías...</p>
            ) : categoriesError ? (
              <p className="text-red-500">{categoriesError}</p>
            ) : expenseCategories.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre de Categoría</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {expenseCategories.map((category) => (
                      <tr key={category.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {category.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {category.name}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600">No hay categorías de gastos disponibles.</p>
            )}
            <button
              onClick={fetchExpenseCategories}
              className="mt-4 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 font-semibold shadow-md"
              disabled={loadingCategories}
            >
              {loadingCategories ? 'Recargando...' : 'Recargar Categorías'}
            </button>
          </div>
        )}
      </div>

      <button
        onClick={onLogout}
        className="mt-4 bg-red-600 text-white py-2 px-6 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 font-semibold shadow-md"
      >
        Cerrar Sesión
      </button>
    </div>
  );
};


// --- Componente de Formulario de Login ---
interface LoginFormProps {
  onRegisterClick: () => void;
  onLoginSuccess: (token: string, email: string) => void; // Callback para éxito de login
}

const LoginForm = ({ onRegisterClick, onLoginSuccess }: LoginFormProps) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(''); // Clear previous messages
    setIsLoading(true); // Set loading state

    try {
      const response = await axios.post('http://198.211.105.95:8080/authentication/login', {
        email,
        passwd: password, // The backend expects 'passwd'
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // --- DEBUGGING: Log the full response data ---
      console.log('Login API Response Data:', response.data);

      // --- MODIFICACIÓN CLAVE AQUÍ ---
      // Accede a 'response.data.result' en lugar de 'response.data.data'
      // Y a 'result.username' en lugar de 'result.email'
      if (response.status === 200 && response.data.status === 200 && response.data.result) {
        const { token, username } = response.data.result; // Destructuring 'username'
        // Store the token and user email (e.g., in localStorage)
        // In a real app, you'd use a secure storage for tokens.
        localStorage.setItem('jwtToken', token);
        localStorage.setItem('userEmail', username); // Store username as userEmail for display or further use

        onLoginSuccess(token, username); // Notify parent of successful login with username
      } else {
        // Refined message based on common issues
        if (response.data && response.data.message) {
          setMessage(`Respuesta inesperada: ${response.data.message}. Verifica la estructura de la respuesta.`);
        } else if (response.data && response.data.status !== 200) {
          setMessage(`Respuesta inesperada: Código de estado en la respuesta de datos no es 200.`);
        } else {
          setMessage('Respuesta inesperada del servidor o estructura de datos incompleta.');
        }
      }
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response) {
        // Handle specific error codes or messages from the API
        if (error.response.status === 401) {
          setMessage('Credenciales inválidas. Por favor, verifica tu correo y contraseña.');
        } else if (error.response.status === 400) {
          setMessage('Error de solicitud: ' + (error.response.data.message || 'Datos incorrectos.'));
        } else {
          setMessage(`Error del servidor: ${error.response.data.message || 'Inténtalo de nuevo más tarde.'}`);
        }
      } else {
        setMessage('Error al intentar conectar con el servidor.');
      }
      console.error('Login error:', error);
    } finally {
      setIsLoading(false); // End loading state
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm text-center">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Iniciar Sesión</h2>
      <form onSubmit={handleLoginSubmit} className="space-y-4">
        <div>
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="loginEmail">
            Correo Electrónico
          </label>
          <input
            type="email"
            id="loginEmail"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
            placeholder="tu@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="loginPassword">
            Contraseña
          </label>
          <input
            type="password"
            id="loginPassword"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out font-semibold shadow-md"
          disabled={isLoading}
        >
          {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
        </button>
      </form>
      {message && (
        <p className="mt-4 text-center text-red-500 text-sm">{message}</p>
      )}
      <p className="mt-4 text-sm text-gray-600">
        ¿No tienes una cuenta?{' '}
        <button
          onClick={onRegisterClick}
          className="text-blue-600 hover:text-blue-800 font-semibold focus:outline-none"
        >
          Regístrate aquí
        </button>
      </p>
    </div>
  );
};


// --- Componente de Formulario de Registro ---
interface RegisterFormProps {
  onLoginClick: () => void;
  onSuccess: (message: string) => void; // Callback para manejar el éxito del registro
}

const RegisterForm = ({ onLoginClick, onSuccess }: RegisterFormProps) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(''); // Clear previous messages
    setIsLoading(true); // Set loading state

    // Basic validation for password length
    if (password.length < 12) {
      setMessage('La contraseña debe tener al menos 12 caracteres.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.post('http://198.211.105.95:8080/authentication/register', {
        email,
        passwd: password, // Note: The backend expects 'passwd' not 'password'
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200) {
        onSuccess('¡Registro exitoso! Se crearon 10,000 gastos aleatorios. Ahora puedes iniciar sesión.');
        setEmail(''); // Clear form fields
        setPassword('');
      } else {
        setMessage('Ocurrió un error inesperado durante el registro.');
      }
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 400) {
          setMessage('Error 400: El correo electrónico ya está registrado.');
        } else {
          setMessage(`Error de registro: ${error.response.data.message || 'Error del servidor.'}`);
        }
      } else {
        setMessage('Error al intentar conectar con el servidor.');
      }
      console.error('Registration error:', error);
    } finally {
      setIsLoading(false); // End loading state
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm text-center">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Registrarse</h2>
      <form onSubmit={handleRegisterSubmit} className="space-y-4">
        <div>
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="registerEmail">
            Correo Electrónico
          </label>
          <input
            type="email"
            id="registerEmail"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 transition duration-150 ease-in-out"
            placeholder="tu@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="registerPassword">
            Contraseña
          </label>
          <input
            type="password"
            id="registerPassword"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 transition duration-150 ease-in-out"
            placeholder="Al menos 12 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={12} // HTML5 validation, but we also do custom check
          />
          {password.length > 0 && password.length < 12 && (
            <p className="text-red-500 text-xs mt-1 text-left">La contraseña debe tener al menos 12 caracteres.</p>
          )}
        </div>
        <button
          type="submit"
          className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 transition duration-150 ease-in-out font-semibold shadow-md"
          disabled={isLoading}
        >
          {isLoading ? 'Registrando...' : 'Crear Cuenta'}
        </button>
      </form>
      {message && (
        <p className={`mt-4 text-sm ${message.includes('éxito') ? 'text-green-600' : 'text-red-500'}`}>
          {message}
        </p>
      )}
      <p className="mt-4 text-sm text-gray-600">
        ¿Ya tienes una cuenta?{' '}
        <button
          onClick={onLoginClick}
          className="text-blue-600 hover:text-blue-800 font-semibold focus:outline-none"
        >
          Inicia sesión
        </button>
      </p>
    </div>
  );
};


// --- Main Home Component ---
export default function Home() {
  const [view, setView] = useState<'landing' | 'login' | 'register' | 'dashboard'>('landing');
  const [registrationSuccessMessage, setRegistrationSuccessMessage] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false); // Track authentication status

  useEffect(() => {
    // Check if a token exists in localStorage on initial load
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('jwtToken');
      if (token) {
        setIsLoggedIn(true);
        setView('dashboard'); // Go directly to dashboard if already logged in
      }
    }
  }, []); // Run only once on mount

  const handleLoginClick = () => {
    setView('login');
    setRegistrationSuccessMessage(''); // Clear message when switching view
  };
  const handleRegisterClick = () => {
    setView('register');
    setRegistrationSuccessMessage(''); // Clear message when switching view
  };
  const handleBackToLanding = () => {
    setView('landing');
    setRegistrationSuccessMessage(''); // Clear message when switching view
  };

  const handleRegistrationSuccess = (msg: string) => {
    setRegistrationSuccessMessage(msg);
    setView('login'); // Automatically switch to login after successful registration
  };

  const handleLoginSuccess = (token: string, email: string) => {
    // Logic to save token and email is now inside LoginForm
    setIsLoggedIn(true);
    setView('dashboard'); // Change view to dashboard upon successful login
    setRegistrationSuccessMessage(''); // Clear any registration success message
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('jwtToken');
      localStorage.removeItem('userEmail');
    }
    setIsLoggedIn(false);
    setView('landing'); // Go back to landing page after logout
  };

  return (
    <div className="grid grid-rows-[minmax(20px,auto)_1fr_minmax(20px,auto)] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] bg-gray-50">
      <main className="flex flex-col gap-8 row-start-2 items-center text-center">
        {registrationSuccessMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{registrationSuccessMessage}</span>
          </div>
        )}

        {isLoggedIn ? (
          <Dashboard onLogout={handleLogout} />
        ) : (
          <>
            {view === 'landing' && (
              <div className="flex flex-col items-center">
                <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
                  ¡Bienvenido a Nuestra Aplicación de Base de Datos!
                </h1>
                <p className="text-lg text-gray-600 mb-8 max-w-prose">
                  Gestiona tus datos de forma eficiente y segura. Inicia sesión para acceder a tu panel o regístrate para empezar.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={handleLoginClick}
                    className="bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 font-semibold shadow-md text-lg"
                  >
                    Iniciar Sesión
                  </button>
                  <button
                    onClick={handleRegisterClick}
                    className="bg-purple-600 text-white py-3 px-6 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 font-semibold shadow-md text-lg"
                  >
                    Registrarse
                  </button>
                </div>
              </div>
            )}

            {view === 'login' && (
              <LoginForm
                onRegisterClick={handleRegisterClick}
                onLoginSuccess={handleLoginSuccess}
              />
            )}

            {view === 'register' && (
              <RegisterForm
                onLoginClick={handleLoginClick}
                onSuccess={handleRegistrationSuccess}
              />
            )}

            {(view === 'login' || view === 'register') && (
              <button
                onClick={handleBackToLanding}
                className="mt-6 text-blue-600 hover:text-blue-800 font-semibold focus:outline-none"
              >
                ← Volver a la Bienvenida
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
