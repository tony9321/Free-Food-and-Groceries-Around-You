import 'stream-browserify';

import React, { useEffect, useState } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import './App.css';
import 'firebase/compat/messaging';

// your own config files for firebase config and firebase cloud message API
import firebaseConfig from './firebaseConfig.json';
import config from './config.json';

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

function App() {
  // State to store the Firestore data
  const [data, setData] = useState([]);

  useEffect(() => {

    //temp, added to debug the android blank issue
    /*var console = {
      log: function(msg) {
        alert(msg);
      }
    };*/

    // Fetch the Firestore data
    const fetchData = async () => {
      const db = firebase.firestore();
      const snapshot = await db.collection('myCollection').doc('myDocument').get();
      const fetchedData = snapshot.data().searchResults;
      setData(fetchedData);
    };

    // Get FCM token
    
    const messaging = firebase.messaging();
    messaging.getToken({
        vapidKey: config.vapidKey,
      })
      .then((currentToken) => {
        if (currentToken) {
          console.log('FCM token:', currentToken);
        } else {
          console.log('No FCM token available.');
        }
      })
      .catch((error) => {
        console.log('Error retrieving FCM token:', error);
      });

    fetchData();
  }, []);

  

  return (
    <div className="container">
      <header className="App-header">
        <h1 className="text-center">Free Food🦛</h1>
        <ul className="list-group">
          {data.map((result, index) => (
            <li key={index} className="list-group-item json-container">
              <strong>Title:</strong> {result.title}<br />
              <strong>Snippet:</strong> {result.snippet}<br />
              <strong>Link:</strong> <a href={result.link}>{result.link}</a><br />
            </li>
          ))}
        </ul>
      </header>
    </div>
  );
}

export default App;
