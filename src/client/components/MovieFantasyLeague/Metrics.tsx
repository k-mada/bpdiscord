import Header from "../Header";
import Spinner from "../Spinner";
import { useMflData } from "../../hooks/useMflData";

const MFLMetrics = () => {
  const { scoringMetrics, loading } = useMflData();

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="min-h-screen bg-letterboxd-bg-primary">
      <Header />
      <main className="main-content">
        <h3>MFL Metrics</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Metric Name</th>
            </tr>
          </thead>
          <tbody>
            {scoringMetrics.map((metric, id) => {
              return (
                <tr key={id}>
                  <td>{metric.metric}</td>
                  <td>{metric.metricName}</td>
                  <td>{metric.pointValue}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </main>
    </div>
  );
};

export default MFLMetrics;
