import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, where, getDocs, updateDoc } from 'firebase/firestore';

// Main App component
export default function App() {
  // State for form inputs
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fiber, setFiber] = useState('');

  // State for the list of food items
  const [foodItems, setFoodItems] = useState([]);
  
  // State for displaying totals
  const [totals, setTotals] = useState({ calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 });

  // State for authentication and Firestore
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  // Initialize Firebase and set up authentication
  useEffect(() => {
    try {
      // Get the app ID and Firebase config from the environment
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
      
      // Initialize Firebase app and services
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const auth = getAuth(app);
      setDb(firestore);

      // Sign in the user with the custom auth token
      const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
      if (token) {
        signInWithCustomToken(auth, token).then((userCredential) => {
          setUserId(userCredential.user.uid);
          setIsAuthReady(true);
        }).catch((error) => {
          console.error("Error signing in with custom token:", error);
          signInAnonymously(auth).then((userCredential) => {
            setUserId(userCredential.user.uid);
            setIsAuthReady(true);
          });
        });
      } else {
        // Fallback to anonymous sign-in if no token is available
        signInAnonymously(auth).then((userCredential) => {
          setUserId(userCredential.user.uid);
          setIsAuthReady(true);
        }).catch((error) => {
          console.error("Error signing in anonymously:", error);
        });
      }
    } catch (error) {
      console.error("Failed to initialize Firebase:", error);
    }
  }, []);

  // Subscribe to real-time data updates from Firestore
  useEffect(() => {
    // Check if Firestore and user ID are ready
    if (!db || !userId) return;

    // Create a query to get the food log for the current user, ordered by timestamp
    const q = query(
      collection(db, `artifacts/${__app_id}/users/${userId}/foodLog`),
      orderBy('timestamp', 'desc')
    );

    // Set up the real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setFoodItems(items);
    }, (error) => {
      console.error("Error listening to food log:", error);
    });

    // Cleanup the listener when the component unmounts
    return () => unsubscribe();
  }, [db, userId]);

  // Calculate totals whenever food items change
  useEffect(() => {
    const newTotals = foodItems.reduce((acc, item) => {
      acc.calories += item.calories;
      acc.protein += item.protein;
      acc.fat += item.fat;
      acc.carbs += item.carbs;
      acc.fiber += item.fiber;
      return acc;
    }, { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 });
    setTotals(newTotals);
  }, [foodItems]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if the user is authenticated
    if (!userId) {
      showTemporaryNotification('Authentication is not ready. Please wait a moment.');
      return;
    }

    // Validate inputs
    if (!foodName || !calories || !protein || !fat || !carbs || !fiber) {
      showTemporaryNotification('Please fill in all fields.');
      return;
    }

    try {
      // Add a new document to the user's food log collection
      await addDoc(collection(db, `artifacts/${__app_id}/users/${userId}/foodLog`), {
        name: foodName,
        calories: Number(calories),
        protein: Number(protein),
        fat: Number(fat),
        carbs: Number(carbs),
        fiber: Number(fiber),
        timestamp: Date.now(),
      });

      // Clear the form after successful submission
      setFoodName('');
      setCalories('');
      setProtein('');
      setFat('');
      setCarbs('');
      setFiber('');

      showTemporaryNotification('Food item added successfully!');

    } catch (e) {
      console.error("Error adding document: ", e);
      showTemporaryNotification('Failed to add food item. Please try again.');
    }
  };

  // Handle deletion of a food item
  const handleDelete = async (itemId) => {
    try {
      await deleteDoc(doc(db, `artifacts/${__app_id}/users/${userId}/foodLog`, itemId));
      showTemporaryNotification('Food item deleted.');
    } catch (e) {
      console.error("Error deleting document: ", e);
      showTemporaryNotification('Failed to delete food item.');
    }
  };

  // Helper function to show a temporary notification message
  const showTemporaryNotification = (message) => {
    setNotificationMessage(message);
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
      setNotificationMessage('');
    }, 3000); // Hide after 3 seconds
  };

  // A simple modal for displaying messages to the user
  const NotificationModal = ({ message, show }) => {
    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-gray-900 bg-opacity-70 absolute inset-0"></div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg transform transition-transform duration-300 scale-100 mx-4 text-center">
          <p className="text-gray-800 dark:text-gray-200 font-semibold">{message}</p>
        </div>
      </div>
    );
  };

  // The main UI
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-200 p-4 sm:p-8 flex flex-col items-center font-sans">
      <div className="w-full max-w-4xl space-y-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-indigo-600 dark:text-indigo-400">
          My Food Tracker
        </h1>

        <NotificationModal message={notificationMessage} show={showNotification} />

        {/* Input Form */}
        <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-center">Add New Food Item</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label htmlFor="foodName" className="block text-sm font-medium mb-1">Food Name</label>
              <input
                type="text"
                id="foodName"
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
                placeholder="e.g., Apple, Chicken Breast"
                className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="calories" className="block text-sm font-medium mb-1">Calories</label>
              <input
                type="number"
                id="calories"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="kcal"
                className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="protein" className="block text-sm font-medium mb-1">Protein (g)</label>
              <input
                type="number"
                id="protein"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                placeholder="grams"
                className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="fat" className="block text-sm font-medium mb-1">Fat (g)</label>
              <input
                type="number"
                id="fat"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                placeholder="grams"
                className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="carbs" className="block text-sm font-medium mb-1">Carbs (g)</label>
              <input
                type="number"
                id="carbs"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                placeholder="grams"
                className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label htmlFor="fiber" className="block text-sm font-medium mb-1">Fiber (g)</label>
              <input
                type="number"
                id="fiber"
                value={fiber}
                onChange={(e) => setFiber(e.target.value)}
                placeholder="grams"
                className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="col-span-1 sm:col-span-2 w-full mt-4 p-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={!isAuthReady}
            >
              {isAuthReady ? 'Add Food' : 'Connecting to database...'}
            </button>
          </form>
        </div>

        {/* Totals Section */}
        <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-center">Daily Totals</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
            <div className="bg-indigo-100 dark:bg-indigo-900 p-4 rounded-xl shadow-inner">
              <p className="text-3xl font-bold text-indigo-800 dark:text-indigo-200">{totals.calories}</p>
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Calories</p>
            </div>
            <div className="bg-indigo-100 dark:bg-indigo-900 p-4 rounded-xl shadow-inner">
              <p className="text-3xl font-bold text-indigo-800 dark:text-indigo-200">{totals.protein}</p>
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Protein (g)</p>
            </div>
            <div className="bg-indigo-100 dark:bg-indigo-900 p-4 rounded-xl shadow-inner">
              <p className="text-3xl font-bold text-indigo-800 dark:text-indigo-200">{totals.fat}</p>
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Fat (g)</p>
            </div>
            <div className="bg-indigo-100 dark:bg-indigo-900 p-4 rounded-xl shadow-inner">
              <p className="text-3xl font-bold text-indigo-800 dark:text-indigo-200">{totals.carbs}</p>
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Carbs (g)</p>
            </div>
            <div className="bg-indigo-100 dark:bg-indigo-900 p-4 rounded-xl shadow-inner">
              <p className="text-3xl font-bold text-indigo-800 dark:text-indigo-200">{totals.fiber}</p>
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Fiber (g)</p>
            </div>
          </div>
        </div>

        {/* Food Log List */}
        <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-center">Food Log</h2>
          {foodItems.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400">Your log is empty. Add a food item above!</p>
          ) : (
            <ul className="space-y-4">
              {foodItems.map((item) => (
                <li key={item.id} className="p-4 bg-gray-100 dark:bg-gray-700 rounded-xl shadow flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
                  <div className="flex-1">
                    <p className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">{item.name}</p>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                      <p><span className="font-medium">Calories:</span> {item.calories} kcal</p>
                      <p><span className="font-medium">Protein:</span> {item.protein} g</p>
                      <p><span className="font-medium">Fat:</span> {item.fat} g</p>
                      <p><span className="font-medium">Carbs:</span> {item.carbs} g</p>
                      <p><span className="font-medium">Fiber:</span> {item.fiber} g</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 ml-0 sm:ml-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 self-end sm:self-center"
                    aria-label="Delete food item"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M16.5 4.478a.75.75 0 01.721.544l.813 9.467.001.218-.001.218a1.5 1.5 0 01-1.442 1.135h-.75c-.347 0-.671-.161-.879-.429-.208-.268-.328-.598-.328-.946V10.75a.75.75 0 00-1.5 0v4.25c0 .348-.12.678-.328.946-.208.268-.532.429-.879.429h-.75a1.5 1.5 0 01-1.442-1.135l-.001-.218.001-.218-.002-9.467a.75.75 0 01.721-.544h7.5z" clipRule="evenodd" />
                      <path d="M12.5 10.75v4.5a.75.75 0 001.5 0v-4.5a.75.75 0 00-1.5 0z" />
                      <path d="M15.5 10.75v4.5a.75.75 0 001.5 0v-4.5a.75.75 0 00-1.5 0z" />
                      <path d="M8.5 10.75v4.5a.75.75 0 001.5 0v-4.5a.75.75 0 00-1.5 0z" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
