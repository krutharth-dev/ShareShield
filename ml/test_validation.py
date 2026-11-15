import copy, json, tempfile, unittest
from pathlib import Path
import numpy as np
from annotation_review import export, validate, ROOT
from calibrate import metrics

class ValidationTests(unittest.TestCase):
    def setUp(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'blind.json';export(p);self.review=json.loads(p.read_text())
        self.source=(ROOT/'ml/review-holdout.json').read_bytes()
        self.categories=set(json.loads((ROOT/'frontend/public/models/context-v1.json').read_text())['classes'])
    def test_blind_export_and_pending_rejection(self):
        self.assertTrue(all(not d['spans'] and 'gold' not in d for d in self.review['documents']))
        with self.assertRaises(AssertionError): validate(self.review,self.source,self.categories)
    def completed(self):
        r=copy.deepcopy(self.review);r.update(reviewer_id='UNIT_TEST_ONLY',reviewed_at='2026-11-05',independently_annotated=True)
        for d in r['documents']: d['status']='complete'
        return r
    def test_custom_source_stays_blind_and_hash_bound(self):
        with tempfile.TemporaryDirectory() as d:
            source=Path(d)/'source.json';output=Path(d)/'review.json'
            source.write_text(json.dumps([dict(id='phase3',text='ರೋಗಿಯ ಸಂಖ್ಯೆ 4829107',language='kan')]))
            export(output,source)
            review=json.loads(output.read_text())
            self.assertEqual(review['documents'][0]['id'],'phase3')
            self.assertEqual(review['documents'][0]['spans'],[])
            with self.assertRaises(AssertionError):validate(review,source.read_bytes(),self.categories)
    def test_duplicate_document_rejected(self):
        r=self.completed();r['documents'][1]=copy.deepcopy(r['documents'][0])
        with self.assertRaises(AssertionError):validate(r,self.source,self.categories)
    def test_source_edit_rejected(self):
        r=self.completed();r['documents'][0]['text']+=' changed'
        with self.assertRaises(AssertionError):validate(r,self.source,self.categories)
    def test_out_of_bounds_rejected(self):
        r=self.completed();r['documents'][0]['spans']=[dict(start=-1,end=2,category='EMAIL')]
        with self.assertRaises(AssertionError):validate(r,self.source,self.categories)
    def test_calibration_metrics_known_case(self):
        m=metrics(np.zeros((2,2)),np.array([0,1]),1)
        self.assertAlmostEqual(m['nll'],np.log(2));self.assertAlmostEqual(m['multiclass_brier'],.5)
        self.assertAlmostEqual(m['ece_10_equal_width_bins'],0)
        self.assertEqual(sum(b['count'] for b in m['reliability_bins']),2)
    def test_overconfident_error_penalized(self):
        z=np.array([[4.,0.],[4.,0.]]);y=np.array([0,1])
        self.assertGreater(metrics(z,y,.1)['nll'],metrics(z,y,1)['nll'])

if __name__=='__main__':unittest.main()
