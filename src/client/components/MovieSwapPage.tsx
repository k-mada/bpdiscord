import { useState } from "react";
import { useComparison } from "../hooks/useComparison";
import MovieSwap from "./MovieSwap";

const MovieSwapPage = () => {
  const { usernames } = useComparison();
  const [selectedUser1, setSelectedUser1] = useState<string>("");
  const [selectedUser2, setSelectedUser2] = useState<string>("");

  const labelFor = (username: string) =>
    usernames.find((u) => u.username === username)?.displayName || username;

  return (
    <div>
      <h1 className="text-3xl font-bold text-letterboxd-text-primary mb-2">
        Movie Swap
      </h1>
      <h3 className="subheading">
        Find films each user has rated that the other hasn't seen
      </h3>
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="select-wrapper">
            <select
              value={selectedUser1}
              onChange={(e) => setSelectedUser1(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Select User 1</option>
              {usernames.map((user) => (
                <option key={user.username} value={user.username}>
                  {user.displayName || user.username}
                </option>
              ))}
            </select>
          </div>
          <div className="select-wrapper">
            <select
              value={selectedUser2}
              onChange={(e) => setSelectedUser2(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Select User 2</option>
              {usernames.map((user) => (
                <option key={user.username} value={user.username}>
                  {user.displayName || user.username}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedUser1 && selectedUser2 && selectedUser1 !== selectedUser2 && (
        <MovieSwap
          user1={selectedUser1}
          user2={selectedUser2}
          user1Label={labelFor(selectedUser1)}
          user2Label={labelFor(selectedUser2)}
        />
      )}
    </div>
  );
};

export default MovieSwapPage;
