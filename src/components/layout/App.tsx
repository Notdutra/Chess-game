import Chessboard from '../../components/chess/Chessboard';
import React from 'react';

const App: React.FC = () => {
  return (
    <>
      <div className="app-container">
        <h1>Chess Game</h1>
        <Chessboard />
      </div>
    </>
  );
};

export default App;
