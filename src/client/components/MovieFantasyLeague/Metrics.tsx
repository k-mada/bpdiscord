import { useEffect, useState } from "react";
import Header from "../Header";
import apiService from "../../services/api";
import { MFLScoringMetric } from "../../types";
import Spinner from "../Spinner";

const MFLMetrics = () => {
  const [scoringMetrics, setScoringMetrics] = useState<MFLScoringMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const getMflMetrics = async () => {
    try {
      setLoading(true);
      apiService.getMflScoringMetrics().then((response) => {
        if (response.data) {
          setScoringMetrics(response.data);
        }
      });
    } catch (err) {
      console.error("Error fetching MFL scoring metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getMflMetrics();
  }, []);

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
